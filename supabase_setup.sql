-- Create the matches table
CREATE TABLE public.matches (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    stream_url TEXT,
    status TEXT,
    match_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended for a public-facing app)
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Create an upsert policy or keep it restricted for service role only.
-- The Node.js script will use the SUPABASE_SERVICE_KEY which automatically bypasses RLS.
-- Here we add a policy to allow public read access for your Next.js/Flutter frontend.
CREATE POLICY "Allow public read access" ON public.matches 
    FOR SELECT 
    USING (true);
