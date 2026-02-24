// src/api.js
const API_BASE_URL = 'http://localhost:5000/api';

export const fetchAgencies = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/agencies`);
        if (!response.ok) throw new Error('Failed to fetch agencies');
        return await response.json();
    } catch (error) {
        console.error("Error fetching agencies:", error);
        return [];
    }
};

export const fetchAgencyMetrics = async (slug) => {
    try {
        const response = await fetch(`${API_BASE_URL}/agencies/${slug}/metrics`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        return await response.json();
    } catch (error) {
        console.error("Error fetching metrics:", error);
        return [];
    }
};