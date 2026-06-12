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

        let rawData = response.data.data || response.data; 
        
        if (!Array.isArray(rawData)) {
            if (rawData && typeof rawData === 'object' && Object.keys(rawData).length === 0) {
                rawData = [];
            } else {
                console.log("Unexpected matches format:", rawData);
                rawData = [];
            }
        }
        
        // The API returns an array of Leagues, each containing a 'matches' array.
        // We need to flatten this into a single array of matches.
        const matches = rawData.flatMap(leagueData => leagueData.matches || []);
        
        console.log(`Found ${matches.length} inprogress match(es) across ${rawData.length} league(s).`);

        // 2. Fetch details for each match to get stream_url
        const detailedMatches = [];
        for (const match of matches) {
            // Some APIs use 'match_id' or '_id' instead of 'id'
            const matchId = match.id || match.match_id || match._id;
            
            if (!matchId) {
                console.log("Skipping match due to missing ID field.");
                continue;
            }
            
            console.log(`Fetching details for match ID: ${matchId}`);
            try {
                const detailResponse = await axios.get(SPORT_SRC_BASE_URL, {
                    headers: { 'X-API-KEY': SPORT_SRC_API_KEY },
                    params: {
                        type: 'detail',
                        id: matchId
                    }
                });
                
                const details = detailResponse.data.data || detailResponse.data || {};
                
                let streamUrl = null;
                
                // The API provides the streaming URL inside the 'sources' array under 'embedUrl'
                if (details.sources && Array.isArray(details.sources) && details.sources.length > 0) {
                    streamUrl = details.sources[0].embedUrl;
                }
                
                // Fallbacks just in case
                if (!streamUrl) {
                    streamUrl = details.stream_url || details.stream || match.stream_url || null;
                }
                
                if (!streamUrl) {
                    console.log(`[DEBUG] No stream found for ${matchId}.`);
                } else {
                    console.log(`Found stream URL for ${matchId}:`, streamUrl);
                }
                
                // Combine the list data with the detailed stream_url
                detailedMatches.push({
                    ...match,
                    id: matchId, // Ensure we standardize the ID field
                    // Look for stream_url in details, fallback to match level if exist
                    stream_url: streamUrl
                });
            } catch (err) {
                console.error(`Failed to fetch details for match ${matchId}:`, err.message);
                detailedMatches.push({ ...match, id: matchId }); 
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
