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
const SPORT_SRC_BASE_URL = 'https://api.sportsrc.org/v2/'; 

async function fetchMatches() {
    try {
        console.log("Fetching matches from SportSRC V2...");
        
        // Get today's date in YYYY-MM-DD format as required by API
        const today = new Date().toISOString().split('T')[0];

        // 1. Fetch the list of inprogress matches
        const response = await axios.get(SPORT_SRC_BASE_URL, {
            headers: { 'X-API-KEY': SPORT_SRC_API_KEY },
            params: {
                type: 'matches',
                sport: 'football',
                status: 'inprogress',
                date: today
            }
        });

        let matches = response.data.data || response.data; 
        
        if (!Array.isArray(matches)) {
            if (matches && typeof matches === 'object' && Object.keys(matches).length === 0) {
                matches = []; // API returned empty object instead of empty array
            } else {
                console.log("Unexpected matches format:", matches);
                matches = [];
            }
        }
        
        console.log(`Found ${matches.length} inprogress match(es).`);

        // 2. Fetch details for each match to get stream_url
        const detailedMatches = [];
        for (const match of matches) {
            if (!match.id) continue;
            
            console.log(`Fetching details for match ID: ${match.id}`);
            try {
                const detailResponse = await axios.get(SPORT_SRC_BASE_URL, {
                    headers: { 'X-API-KEY': SPORT_SRC_API_KEY },
                    params: {
                        type: 'detail',
                        id: match.id
                    }
                });
                
                const details = detailResponse.data.data || detailResponse.data || {};
                
                // Combine the list data with the detailed stream_url
                detailedMatches.push({
                    ...match,
                    // Look for stream_url in details, fallback to match level if exist
                    stream_url: details.stream_url || details.stream || match.stream_url || null
                });
            } catch (err) {
                console.error(`Failed to fetch details for match ${match.id}:`, err.message);
                detailedMatches.push(match); // Push without stream_url to at least keep status updated
            }
        }

        return detailedMatches;

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
        id: match.id.toString(), 
        title: match.title || match.name || 'Unknown Match',
        stream_url: match.stream_url, 
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
