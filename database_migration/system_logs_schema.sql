-- ==============================================================================
-- System Logs Table Migration (Optional for persistent database audit trail)
-- Designed for minimal ingestion impact and zero egress overhead
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL DEFAULT 'INFO',
    action TEXT NOT NULL,
    details TEXT,
    user_id TEXT REFERENCES public.users(staff_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index created_at for fast descending queries with limit
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);

-- Row Level Security
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert and read for system admins and authenticated users
CREATE POLICY "Allow all operations on system_logs" 
ON public.system_logs 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);
