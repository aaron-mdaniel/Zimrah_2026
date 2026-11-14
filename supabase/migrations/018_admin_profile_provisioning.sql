-- ==============================================================================
-- ZIMRAH 2026 – Migration 018: Administrator Profile Self-Provisioning & Sync RPC
-- Ensures authentic Supabase Auth users are linked to user_profiles with proper role
-- ==============================================================================

-- 1. Ensure user profile function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
    v_role TEXT := 'SUPER_ADMIN';
    v_admin_count INT;
    v_profile RECORD;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required: auth.uid() is null.';
    END IF;

    -- Look up email from auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    -- Count existing SUPER_ADMINs
    SELECT count(*) INTO v_admin_count FROM public.user_profiles WHERE role = 'SUPER_ADMIN';

    -- If no super admins exist, or user email contains 'admin', or username contains 'admin', grant SUPER_ADMIN
    IF v_admin_count = 0 OR v_email ILIKE '%admin%' THEN
        v_role := 'SUPER_ADMIN';
    ELSE
        v_role := 'RESULT_ADMIN';
    END IF;

    -- Upsert profile record
    INSERT INTO public.user_profiles (id, username, full_name, role, is_active)
    VALUES (
        v_uid,
        split_part(COALESCE(v_email, 'admin'), '@', 1),
        'Administrator',
        v_role,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE 
    SET is_active = TRUE,
        role = CASE 
            WHEN v_email ILIKE '%admin%' OR v_admin_count = 0 THEN 'SUPER_ADMIN' 
            ELSE public.user_profiles.role 
        END;

    SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_uid;
    RETURN to_jsonb(v_profile);
END;
$$;

-- Allow authenticated users to call ensure_user_profile
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

-- 2. Allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "Profiles: user insert own" ON public.user_profiles;
CREATE POLICY "Profiles: user insert own"
    ON public.user_profiles FOR INSERT
    WITH CHECK (id = auth.uid() OR public.is_super_admin());
