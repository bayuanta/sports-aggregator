/**
 * scripts/update_matches.js
 * 
 * This script fetches 'inprogress' and 'upcoming' matches from the SportSRC V2 API.
 * It uses a smart Just-In-Time link fetching logic:
 * - Saves all matches for the day to Supabase to build the schedule.
 * - ONLY fetches stream details for matches that are 'inprogress' or starting within 15 minutes.
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SPORT_SRC_API_KEY = process.env.SPORT_SRC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // 1. Fetch both inprogress and upcoming lists concurrently
        const [inProgressRes, upcomingRes] = await Promise.all([
            axios.get(SPORT_SRC_BASE_URL, {
                headers: { 'X-API-KEY': SPORT_SRC_API_KEY },
                params: { type: 'matches', sport: 'football', status: 'inprogress', date: today }
            }).catch(e => { console.error("Error fetching inprogress:", e.message); return { data: { data: [] } }; }),
            axios.get(SPORT_SRC_BASE_URL, {
                headers: { 'X-API-KEY': SPORT_SRC_API_KEY },
                params: { type: 'matches', sport: 'football', status: 'upcoming', date: today }
            }).catch(e => { console.error("Error fetching upcoming:", e.message); return { data: { data: [] } }; })
        ]);

        let inProgressRaw = inProgressRes.data.data || inProgressRes.data || [];
        let upcomingRaw = upcomingRes.data.data || upcomingRes.data || [];
        
        if (!Array.isArray(inProgressRaw)) inProgressRaw = [];
        if (!Array.isArray(upcomingRaw)) upcomingRaw = [];
        
        const inProgressMatches = inProgressRaw.flatMap(leagueData => leagueData.matches || []);
        const upcomingMatches = upcomingRaw.flatMap(leagueData => leagueData.matches || []);
        
        const allMatches = [...inProgressMatches, ...upcomingMatches];
        console.log(`Found ${inProgressMatches.length} inprogress and ${upcomingMatches.length} upcoming matches.`);

        // 2. Process matches and selectively fetch stream links
        const detailedMatches = [];
        
        for (const match of allMatches) {
            const matchId = match.id || match.match_id || match._id;
            if (!matchId) continue;
            
            let shouldFetchDetail = false;
            
            if (match.status === 'inprogress') {
                shouldFetchDetail = true;
            } else if (match.status === 'upcoming') {
                // Check if match starts in less than 15 minutes
                const matchTime = match.timestamp ? new Date(match.timestamp).getTime() : new Date(match.match_date || match.date || match.start_time).getTime();
                const now = Date.now();
                const timeDiffMinutes = (matchTime - now) / (1000 * 60);
                
                // If the match is in the past, or less than 15 minutes away, we want the link
                if (timeDiffMinutes <= 15) {
                    shouldFetchDetail = true;
                    console.log(`Match ${matchId} starts in ${Math.round(timeDiffMinutes)} mins. Fetching link early!`);
                }
            }
            
            if (shouldFetchDetail) {
                console.log(`Fetching details for match ID: ${matchId}`);
                try {
                    const detailResponse = await axios.get(SPORT_SRC_BASE_URL, {
                        headers: { 'X-API-KEY': SPORT_SRC_API_KEY },
                        params: { type: 'detail', id: matchId }
                    });
                    
                    const details = detailResponse.data.data || detailResponse.data || {};
                    let streamUrl = null;
                    
                    if (details.sources && Array.isArray(details.sources) && details.sources.length > 0) {
                        streamUrl = details.sources[0].embedUrl;
                    }
                    if (!streamUrl) {
                        streamUrl = details.stream_url || details.stream || match.stream_url || null;
                    }
                    
                    detailedMatches.push({
                        ...match,
                        id: matchId,
                        stream_url: streamUrl
                    });
                } catch (err) {
                    console.error(`Failed to fetch details for match ${matchId}:`, err.message);
                    detailedMatches.push({ ...match, id: matchId, stream_url: null }); 
                }
            } else {
                // For upcoming matches far in the future, just save the basic data without link
                detailedMatches.push({ ...match, id: matchId, stream_url: null });
            }
        }

        return detailedMatches;

    } catch (error) {
        console.error("Error in fetch logic:", error.message);
        throw error;
    }
}

async function upsertMatchesToSupabase(matches) {
    if (!matches || matches.length === 0) {
        console.log("No matches to upsert.");
        return;
    }

    console.log("Upserting matches to Supabase...");

    const dataToUpsert = matches.map(match => ({
        id: match.id.toString(), 
        title: match.title || match.name || 'Unknown Match',
        stream_url: match.stream_url, 
        status: match.status || 'upcoming',
        match_date: match.match_date || match.date || match.start_time || new Date().toISOString(),
        updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
        .from('matches')
        .upsert(dataToUpsert, { onConflict: 'id' });

    if (error) {
        console.error("Error upserting to Supabase:", error.message);
        throw error;
    }

    console.log(`Successfully upserted ${matches.length} matches to Supabase.`);
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
