/**
 * scripts/update_matches.js
 * 
 * This script fetches 'inprogress' matches from the SportSRC V2 API and upserts them into Supabase.
 * It is designed to be run via a GitHub Actions workflow.
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SPORT_SRC_API_KEY = process.env.SPORT_SRC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Requires service role key to bypass RLS for upserting

if (!SPORT_SRC_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing required environment variables. Please check your configuration.");
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SportSRC V2 API Configuration
// Update this base URL if the actual SportSRC V2 endpoint is different
const SPORT_SRC_BASE_URL = 'https://api.sportsrc.com/v2'; 

async function fetchMatches() {
    try {
        console.log("Fetching matches from SportSRC V2...");
        
        // Fetch matches. Adjust the endpoint and params based on the exact SportSRC docs.
        const response = await axios.get(`${SPORT_SRC_BASE_URL}/matches`, {
            headers: {
                'X-API-KEY': SPORT_SRC_API_KEY,
                'Content-Type': 'application/json'
            },
            params: {
                status: 'inprogress'
            }
        });

        // The API might return an array directly or inside a wrapper (like response.data.data)
        const matches = response.data.data || response.data; 
        
        if (!Array.isArray(matches)) {
            throw new Error("Unexpected API response format. Expected an array of matches.");
        }
        
        console.log(`Fetched ${matches.length} matches.`);
        return matches;

    } catch (error) {
        console.error("Error fetching from SportSRC API:", error.message);
        throw error;
    }
}

async function upsertMatchesToSupabase(matches) {
    if (!matches || matches.length === 0) {
        console.log("No matches to upsert.");
        return;
    }

    console.log("Upserting matches to Supabase...");

    // Map external API data to our Supabase database schema
    const dataToUpsert = matches.map(match => ({
        id: match.id.toString(), // Ensure ID is a string for the DB primary key
        title: match.title || match.name || 'Unknown Match',
        
        // Storing stream_url as per requirements. The iframe integration will be handled 
        // by the frontend (Next.js / Flutter) using this exact URL.
        stream_url: match.stream_url || match.url, 
        
        status: match.status || 'inprogress',
        match_date: match.match_date || match.date || match.start_time || new Date().toISOString(),
        updated_at: new Date().toISOString()
    }));

    // Perform upsert, resolving conflicts on the 'id' column
    const { data, error } = await supabase
        .from('matches')
        .upsert(dataToUpsert, { onConflict: 'id' });

    if (error) {
        console.error("Error upserting to Supabase:", error.message);
        throw error;
    }

    console.log("Successfully upserted matches to Supabase.");
}

async function run() {
    try {
        const matches = await fetchMatches();
        await upsertMatchesToSupabase(matches);
        console.log("Update process completed successfully.");
    } catch (error) {
        console.error("Update process failed.");
        process.exit(1);
    }
}

// Execute the script
run();
