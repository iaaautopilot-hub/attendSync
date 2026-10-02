-- ==============================================================================
-- AttendSync / Attendance List Web App - Database Schema Migration
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if needed (in reverse dependency order)
DROP TABLE IF EXISTS public.event_signatures CASCADE;
DROP TABLE IF EXISTS public.event_assignments CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.hub CASCADE;
DROP TABLE IF EXISTS public.rank CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- 3. Create 'roles' table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT NOT NULL UNIQUE,
    role_description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create 'rank' table
CREATE TABLE public.rank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rank_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create 'hub' table
CREATE TABLE public.hub (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create 'departments' table
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create 'users' table
CREATE TABLE public.users (
    staff_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    rank_id UUID REFERENCES public.rank(id) ON DELETE SET NULL,
    loa_no TEXT DEFAULT '',
    hub_id UUID REFERENCES public.hub(id) ON DELETE SET NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    auth_id UUID,
    must_change_password BOOLEAN DEFAULT false,
    email TEXT,
    username TEXT,
    password TEXT,
    signature_data TEXT,
    multi_roles TEXT[] DEFAULT '{}'::TEXT[]
);

-- 8. Create 'events' table
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code TEXT,
    event_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    event_date DATE NOT NULL,
    department TEXT,
    venue TEXT,
    room TEXT,
    training_type TEXT,
    created_by TEXT CONSTRAINT events_created_by_fkey REFERENCES public.users(staff_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    event_time TEXT,
    is_active BOOLEAN DEFAULT false,
    leader_signature TEXT,
    activated_at TIMESTAMPTZ,
    remarks TEXT
);

-- 9. Create 'event_assignments' table
CREATE TABLE public.event_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(staff_id) ON DELETE CASCADE,
    assigned_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Create 'event_signatures' table
CREATE TABLE public.event_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    remarks TEXT DEFAULT '',
    signed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    participant_name TEXT,
    participant_rank TEXT,
    participant_hub TEXT,
    participant_license TEXT,
    signature_data TEXT
);

-- 11. Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON public.events(is_active);
CREATE INDEX IF NOT EXISTS idx_event_assignments_event_id ON public.event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_user_id ON public.event_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_signatures_event_id ON public.event_signatures(event_id);
CREATE INDEX IF NOT EXISTS idx_event_signatures_staff_id ON public.event_signatures(staff_id);

-- 12. Enable Row Level Security (RLS) & Add Public Access Policies
-- (The app uses Supabase anon client key for public signatures and authenticated dashboards)

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on roles" ON public.roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.rank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on rank" ON public.rank FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.hub ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on hub" ON public.hub FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on departments" ON public.departments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on events" ON public.events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_assignments" ON public.event_assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.event_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_signatures" ON public.event_signatures FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 13. Grant Permissions to anon, authenticated, and service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
