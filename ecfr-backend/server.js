// server.js
const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); 
app.use(express.json());

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * 1. GET /api/agencies
 * Returns a list of all agencies to populate the frontend UI
 */
app.get('/api/agencies', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT slug, name, short_name, parent_slug 
            FROM agencies 
            ORDER BY name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching agencies" });
    }
});

/**
 * 2. GET /api/agencies/:slug/metrics
 * Returns the time-series data for a specific agency to draw the charts
 */
app.get('/api/agencies/:slug/metrics', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const result = await pool.query(`
            SELECT date, word_count, restrictive_word_count, checksum 
            FROM agency_metrics 
            WHERE agency_slug = $1 
            ORDER BY date ASC
        `, [slug]);
        
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error fetching metrics" });
    }
});

// ============================================================================
// STARTING THE SERVER
// ============================================================================
app.listen(PORT, () => {
    console.log(`Server is running on: http://localhost:${PORT}`);
    console.log(`endpoint: http://localhost:${PORT}/api/agencies`);
});