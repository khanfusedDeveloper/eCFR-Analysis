//creates our table in the db

const pool = require('./db');

const creatTables = async () => {

    const schemaQuery = `
    -- Table 1: Agencies
    CREATE TABLE IF NOT EXISTS agencies (
        slug VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        short_name VARCHAR(255),
        parent_slug VARCHAR(255) REFERENCES agencies(slug),
        cfr_references JSONB
    );
    
    -- Table 2: Over time Metrics
    CREATE TABLE IF NOT EXISTS agency_metrics (
        id SERIAL PRIMARY KEY,
        agency_slug VARCHAR(255) REFERENCES agencies(slug) ON DELETE CASCADE,
        date DATE NOT NULL,
        word_count INTEGER,
        checksum VARCHAR(255),
        restrictive_word_count INTEGER,
        UNIQUE(agency_slug, date)

    
    );`;


    try {
        console.log('Trying to create the tables...');
        await pool.query(schemaQuery);
        console.log("Tables created successfully!");
    }
    catch (err){
        console.error('error creating tables', err);

    }
    finally{
        await pool.end();
    }


}

creatTables();

