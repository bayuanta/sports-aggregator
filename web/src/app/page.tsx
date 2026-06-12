import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const revalidate = 60; // Revalidate cache every 60 seconds

export default async function Home() {
  // Fetch only matches with status 'inprogress' from Supabase
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'inprogress')
    .order('match_date', { ascending: false });

  if (error) {
    console.error("Error fetching matches:", error);
  }

  return (
    <div className="container">
      <header className="app-header">
        <h1>Live Sports</h1>
        <p>Watch your favorite matches happening right now.</p>
      </header>

      <main>
        {(!matches || matches.length === 0) ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2>No live matches currently.</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
              Check back later when there are games in progress.
            </p>
          </div>
        ) : (
          <div className="matches-grid">
            {matches.map((match) => (
              <Link href={`/watch/${match.id}`} key={match.id}>
                <div className="match-card glass-panel">
                  <div className="match-header">
                    <div className="live-indicator">
                      <span className="live-dot"></span> LIVE
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="match-teams">
                    <div className="team">
                      {/* Simple placeholder for team logo, we can use title splitting if needed */}
                      <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', marginBottom: '0.5rem' }}></div>
                      <span className="team-name">{match.title.split(' vs ')[0] || match.title}</span>
                    </div>
                    
                    <div className="vs-badge">VS</div>
                    
                    <div className="team">
                      <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', marginBottom: '0.5rem' }}></div>
                      <span className="team-name">{match.title.split(' vs ')[1] || 'TBD'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
