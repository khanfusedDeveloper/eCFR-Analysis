//gets api data from eCFR api
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = require('../db');
const crypto = require('crypto');

const ECFR_BASE_URL = 'https://www.ecfr.gov';

//simply gets the JSON from the api get request
const fetchRawAgencies = async () => {
    console.log("Getting agencies JSON from eCFR...");
    const response = await fetch(`${ECFR_BASE_URL}/api/admin/v1/agencies.json`);
    if (!response.ok){
        throw new Error(`Something went wrong fetching agencies: , ${response.statusText}`);
    }

    const data = await response.json();
    return data.agencies;
};

//Flattens the agencies into one long array so we can push it to postgres. The children if there are any are pushed onto the array one by one.
//O(n^2) runtime.
const flattenAgencies = (rawAgencies) => {
    const flatList = [];

    rawAgencies.forEach(element => {
        flatList.push({
            slug: element.slug,
            name: element.name,
            short_name: element.short_name,
            parent_slug: null,
            cfr_references: JSON.stringify(element.cfr_references || [])
        });

        if (element.children && element.children.length > 0){
            element.children.forEach(childrenElement => {
                flatList.push({
                    slug: childrenElement.slug,
                    name: childrenElement.name,
                    short_name: childrenElement.short_name,
                    parent_slug: element.slug,
                    cfr_references: JSON.stringify(childrenElement.cfr_references || [])
                });
            });
        }
    });

    return flatList;
}

const saveAgenciesToDB = async (flattenAgenciesList) => {
    console.log(`saving ${flattenAgenciesList.length} to db agencies table`);
    const client = await pool.connect();

    try{
        await client.query('BEGIN');

        for (const agency of flattenAgenciesList) {
            await client.query(`INSERT INTO agencies
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name, 
                    short_name = EXCLUDED.short_name,
                    cfr_references = EXCLUDED.cfr_references;
                `, [agency.slug, agency.name, agency.short_name, agency.parent_slug, agency.cfr_references])
        }

        await client.query('COMMIT');
        console.log('Saved the agencies to the DB!')
    }
    catch(error){
        console.error(`Ran into error while writing to agencies TABLE in DATABASE ecfr_db ${error}.. ROLLING BACK`);
        await client.query('ROLLBACK');
        throw error;
    }
    finally{
        client.release();
    }
};

const syncAgencies = async () => {
    try{
        const rawAgencies = await fetchRawAgencies();
        const FlattendAgenciesList = flattenAgencies(rawAgencies);
        await saveAgenciesToDB(FlattendAgenciesList);
    }
    catch(error){
        console.error(`Error in syncAgencies ${error}`);
        throw error;
    }
};

const getPartsForChapter = async (date, title, chapter) => {
    try {
        const res = await fetch(`https://www.ecfr.gov/api/versioner/v1/structure/${date}/title-${title}.json`);
        if (!res.ok) return [];
        const structure = await res.json();

        const extractParts = (node, inTarget = false) => {
            let parts = [];
            if (node.type === 'chapter' && node.identifier === chapter) {
                inTarget = true;
            }
            if (inTarget && node.type === 'part') {
                parts.push(node.identifier);
            }
            if (node.children) {
                for (const child of node.children) {
                    parts = parts.concat(extractParts(child, inTarget));
                }
            }
            return parts;
        };

        return extractParts(structure);
    } catch (e) {
        console.error(`Failed to get parts for Title ${title}, Chapter ${chapter}`);
        return [];
    }
};

const getPartText = async (date, title, part) => {
    try {
        const res = await fetch(`https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${title}.xml?part=${part}`);
        if (!res.ok) return "";
        const xml = await res.text();
        
        // Strip out XML tags to get raw words
        return xml.replace(/(<([^>]+)>)/gi, " ");
    } catch (e) {
        return "";
    }
};

const getValidDateForTitle = async (title) => {
    let d = new Date();
    // eCFR doesn't record data on weekends for some reason so we need to account if the script runs on weekends. We'll tell it specifically get data from working days
    for (let i = 0; i < 5; i++) {
        const dateStr = d.toISOString().split('T')[0];
        const res = await fetch(`https://www.ecfr.gov/api/versioner/v1/structure/${dateStr}/title-${title}.json`);
        if (res.ok) {
            return dateStr;
        }
        d.setDate(d.getDate() - 1);
    }
    return new Date().toISOString().split('T')[0];
};

const processAgencyMetrics = async () => {
    const client = await pool.connect();

    try {
        const res = await client.query(`
            SELECT slug, cfr_references 
            FROM agencies 
            WHERE cfr_references IS NOT NULL 
            AND cfr_references::text != '[]'
        `);
        
        const agencies = res.rows;
        console.log(`Processing metrics for ${agencies.length} agencies...`);

        for (const agency of agencies) {
            console.log(`\n--- Processing: ${agency.slug} ---`);
            let totalText = "";

            const references = agency.cfr_references; 
            
            for (const ref of references) {

                const validDate = await getValidDateForTitle(ref.title);
                console.log(`Using date ${validDate} for Title ${ref.title}`);

                const parts = await getPartsForChapter(validDate, ref.title, ref.chapter);
                console.log(`Found ${parts.length} parts for Chapter ${ref.chapter}`);
                
                for (const part of parts) { 
                    const text = await getPartText(validDate, ref.title, part);
                    totalText += text + " ";
                }
            }

            // --- CALCULATE METRICS ---
            const cleanText = totalText.toLowerCase();
            const words = cleanText.split(/\s+/).filter(w => w.length > 0);
            const wordCount = words.length;

            const restrictives = ['shall', 'must', 'prohibited', 'required'];
            let restrictiveCount = words.filter(w => restrictives.includes(w)).length;
            restrictiveCount += (cleanText.match(/may not/g) || []).length;

            const checksum = totalText.trim().length > 0 
                ? crypto.createHash('sha256').update(totalText).digest('hex')
                : 'no-text-found';

            await client.query(`
                INSERT INTO agency_metrics (agency_slug, date, word_count, checksum, restrictive_word_count)
                VALUES ($1, CURRENT_DATE, $2, $3, $4)
                ON CONFLICT (agency_slug, date) DO UPDATE 
                SET word_count = EXCLUDED.word_count,
                    checksum = EXCLUDED.checksum,
                    restrictive_word_count = EXCLUDED.restrictive_word_count;
            `, [agency.slug, wordCount, checksum, restrictiveCount]);
            
            console.log(`Saved metrics | Words: ${wordCount} | Restrictive: ${restrictiveCount}`);
        }
        
        console.log("\nFinished processing agency metrics!");

    } catch (error) {
        console.error("Error processing metrics:", error);
    } finally {
        client.release();
    }
};

module.exports = {
    syncAgencies,
    processAgencyMetrics
};

const runPipeline = async () => {
    try {
        console.log("Starting full data pipeline...");
        await syncAgencies();
        await processAgencyMetrics();
        console.log("\nPipeline complete!");
    } catch (err) {
        console.error("\n Pipeline failed:", err);
    } finally {
        await pool.end();
    }
};

runPipeline();