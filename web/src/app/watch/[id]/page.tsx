import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const matchId = resolvedParams.id;
  
  // Fetch match details from Supabase
  const { data: match, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error || !match) {
    notFound();
  }

  return (
    <div className="watch-container">
      <Link href="/" className="back-link">
        ← Back to Matches
      </Link>

      <div>
        <div className="player-wrapper">
          {match.stream_url ? (
            <iframe 
              src={match.stream_url}
              width="100%" 
              height="100%" 
              frameBorder="0" 
              scrolling="no"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="origin"
              allowFullScreen
              title={match.title}
            ></iframe>
          ) : (
            <div style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', color: 'var(--text-muted)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📺</div>
              <h3>Stream currently unavailable</h3>
              <p>Please try again later or check another match.</p>
            </div>
          )}
        </div>

        <div className="watch-info glass-panel" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="watch-title">{match.title}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                Status: <span style={{ color: match.status === 'inprogress' ? 'var(--live-red)' : 'inherit', fontWeight: 'bold' }}>
                  {match.status.toUpperCase()}
                </span>
              </p>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)' }}>Kickoff Time</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                {new Date(match.match_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
