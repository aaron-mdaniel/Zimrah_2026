-- ==============================================================================
-- ZIMRAH 2026 – Migration 002: User Profiles & Administrative Roles
-- ==============================================================================

-- 1. Ensure mock auth.users exists only for offline/standalone PostgreSQL without Supabase Auth
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        BEGIN
            CREATE SCHEMA IF NOT EXISTS auth;
            CREATE TABLE IF NOT EXISTS auth.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE,
                raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        EXCEPTION WHEN insufficient_privilege THEN
            NULL;
        END;
    END IF;
END $$;

-- 2. User Profiles Table
-- Mirrors apps.accounts.models.User (SUPER_ADMIN, RESULT_ADMIN, PUBLISHER)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(150) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(20) NOT NULL DEFAULT 'RESULT_ADMIN' 
        CHECK (role IN ('SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER')),
    phone VARCHAR(20) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

COMMENT ON TABLE public.user_profiles IS 'User administrative profiles linked to Supabase Auth with custom role permissions.';
COMMENT ON COLUMN public.user_profiles.role IS 'SUPER_ADMIN: full access; RESULT_ADMIN: score entry & draft saving; PUBLISHER: final publication and corrections.';
