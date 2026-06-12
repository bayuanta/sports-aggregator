import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const revalidate = 60; // Revalidate cache every 60 seconds

export default async function Home() {
  // Fetch both 'inprogress' and 'upcoming' matches
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['inprogress', 'upcoming'])
    .order('match_date', { ascending: true });

  if (error) {
    console.error("Error fetching matches:", error);
  }

  const liveMatches = matches?.filter(m => m.status === 'inprogress') || [];
  const upcomingMatches = matches?.filter(m => m.status === 'upcoming') || [];

  return (
    <div className="container">
      <header className="app-header">
        <h1>Live Sports</h1>
        <p>Watch your favorite matches happening right now and see what's coming next.</p>
      </header>

      <main>
        {/* LIVE MATCHES SECTION */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="live-dot" style={{ display: 'inline-block' }}></span> Live Now
          </h2>
          
          {liveMatches.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                No live matches currently.
              </p>
            </div>
          ) : (
            <div className="matches-grid">
              {liveMatches.map((match) => (
                <Link href={`/watch/${match.id}`} key={match.id}>
                  <div className="match-card glass-panel" style={{ borderColor: 'var(--live-red)' }}>
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
        </section>

        {/* UPCOMING MATCHES SECTION */}
        <section>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', color: 'var(--text-muted)' }}>
            🗓️ Upcoming Matches
          </h2>
          
          {upcomingMatches.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                No upcoming matches scheduled for today.
              </p>
            </div>
          ) : (
            <div className="matches-grid">
              {upcomingMatches.map((match) => (
                <Link href={`/watch/${match.id}`} key={match.id}>
                  <div className="match-card glass-panel" style={{ opacity: 0.8 }}>
                    <div className="match-header">
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.5px' }}>
                        UPCOMING
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                        {new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="match-teams">
                      <div className="team">
                        <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '0.5rem' }}></div>
                        <span className="team-name" style={{ color: 'var(--text-muted)' }}>{match.title.split(' vs ')[0] || match.title}</span>
                      </div>
                      
                      <div className="vs-badge" style={{ background: 'transparent', border: '1px solid var(--border-glass)' }}>VS</div>
                      
                      <div className="team">
                        <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', marginBottom: '0.5rem' }}></div>
                        <span className="team-name" style={{ color: 'var(--text-muted)' }}>{match.title.split(' vs ')[1] || 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
