-- ==============================================================================
-- ZIMRAH 2026 – Migration 012: Authentication, Security Functions & RLS Policies
-- ==============================================================================

-- 0. Ensure auth.uid() and Supabase roles exist for standalone / local testing compatibility
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- 1. Helper Security Functions (SECURITY DEFINER, explicit search_path)
-- Bypasses RLS to avoid recursion when evaluating policies

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER') AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_publisher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'PUBLISHER') AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'SUPER_ADMIN' AND is_active = TRUE
    );
$$;

-- 2. Prevent Role Escalation Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
        -- Allow system superusers / service_role to seed and update roles
        IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
            RETURN NEW;
        END IF;

        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN can modify user roles or active status.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_prevent_role_escalation();

-- 3. Enforce Result Publishing Permissions Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_result_publishing_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow system superusers / service_role during seeding / direct administration
    IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Only SUPER_ADMIN and PUBLISHER can set status to PUBLISHED
    IF (NEW.status = 'PUBLISHED' AND (TG_OP = 'INSERT' OR OLD.status != 'PUBLISHED')) THEN
        IF NOT public.is_publisher() THEN
            RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN and PUBLISHER roles can publish results.';
        END IF;
    END IF;

    -- Only SUPER_ADMIN and PUBLISHER can unpublish (revert from PUBLISHED to DRAFT)
    IF (TG_OP = 'UPDATE' AND OLD.status = 'PUBLISHED' AND NEW.status != 'PUBLISHED') THEN
        IF NOT public.is_publisher() THEN
            RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN and PUBLISHER roles can unpublish results.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_enforce_result_publishing ON public.event_results;
CREATE TRIGGER trg_enforce_result_publishing
    BEFORE INSERT OR UPDATE OF status ON public.event_results
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_enforce_result_publishing_permissions();

DO $$
BEGIN
    ALTER TABLE IF EXISTS auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN insufficient_privilege THEN
    NULL;
END $$;

-- 4. Automatic Profile Creation on auth.users Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_raw_meta JSONB;
BEGIN
    v_raw_meta := COALESCE(to_jsonb(NEW)->'raw_user_meta_data', '{}'::jsonb);
    INSERT INTO public.user_profiles (id, username, full_name, role, phone, is_active)
    VALUES (
        NEW.id,
        COALESCE(v_raw_meta->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(v_raw_meta->>'full_name', ''),
        'RESULT_ADMIN', -- Safe default non-privileged role
        COALESCE(v_raw_meta->>'phone', ''),
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_registration_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.editions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.churches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.participants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_divisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.group_registration_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.result_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.result_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.point_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. POLICIES: User Profiles
-- ==============================================================================
DROP POLICY IF EXISTS "Profiles: user read own or super admin" ON public.user_profiles;
CREATE POLICY "Profiles: user read own or super admin"
    ON public.user_profiles FOR SELECT
    USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Profiles: super admin insert" ON public.user_profiles;
CREATE POLICY "Profiles: super admin insert"
    ON public.user_profiles FOR INSERT
    WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Profiles: user update own or super admin" ON public.user_profiles;
CREATE POLICY "Profiles: user update own or super admin"
    ON public.user_profiles FOR UPDATE
    USING (id = auth.uid() OR public.is_super_admin())
    WITH CHECK (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Profiles: super admin delete" ON public.user_profiles;
CREATE POLICY "Profiles: super admin delete"
    ON public.user_profiles FOR DELETE
    USING (public.is_super_admin());

-- ==============================================================================
-- 7. POLICIES: Master Data (Editions, Churches, Event Taxonomy, Events)
-- ==============================================================================
-- Public read, Super Admin write

-- Editions
DROP POLICY IF EXISTS "Editions: public read" ON public.editions;
CREATE POLICY "Editions: public read" ON public.editions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Editions: super admin write" ON public.editions;
CREATE POLICY "Editions: super admin write" ON public.editions FOR ALL USING (public.is_super_admin());

-- Churches
DROP POLICY IF EXISTS "Churches: public read active" ON public.churches;
CREATE POLICY "Churches: public read active" ON public.churches FOR SELECT USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Churches: super admin write" ON public.churches;
CREATE POLICY "Churches: super admin write" ON public.churches FOR ALL USING (public.is_super_admin());

-- Categories, Divisions, Sections
DROP POLICY IF EXISTS "Categories: public read" ON public.event_categories;
CREATE POLICY "Categories: public read" ON public.event_categories FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Categories: super admin write" ON public.event_categories;
CREATE POLICY "Categories: super admin write" ON public.event_categories FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "Divisions: public read" ON public.event_divisions;
CREATE POLICY "Divisions: public read" ON public.event_divisions FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Divisions: super admin write" ON public.event_divisions;
CREATE POLICY "Divisions: super admin write" ON public.event_divisions FOR ALL USING (public.is_super_admin());

DROP POLICY IF EXISTS "Sections: public read" ON public.event_sections;
CREATE POLICY "Sections: public read" ON public.event_sections FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Sections: super admin write" ON public.event_sections;
CREATE POLICY "Sections: super admin write" ON public.event_sections FOR ALL USING (public.is_super_admin());

-- Events
DROP POLICY IF EXISTS "Events: public read" ON public.events;
CREATE POLICY "Events: public read" ON public.events FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Events: super admin write" ON public.events;
CREATE POLICY "Events: super admin write" ON public.events FOR ALL USING (public.is_super_admin());

-- ==============================================================================
-- 8. POLICIES: Participants & Registrations
-- ==============================================================================
-- Public read for schedules/badges, Admin write

DROP POLICY IF EXISTS "Participants: public read" ON public.participants;
CREATE POLICY "Participants: public read" ON public.participants FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Participants: admin write" ON public.participants;
CREATE POLICY "Participants: admin write" ON public.participants FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Registrations: public read" ON public.registrations;
CREATE POLICY "Registrations: public read" ON public.registrations FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Registrations: admin write" ON public.registrations;
CREATE POLICY "Registrations: admin write" ON public.registrations FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Group Members: public read" ON public.group_registration_members;
CREATE POLICY "Group Members: public read" ON public.group_registration_members FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Group Members: admin write" ON public.group_registration_members;
CREATE POLICY "Group Members: admin write" ON public.group_registration_members FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 9. POLICIES: Event Results & Entries
-- ==============================================================================

-- Event Results: Public reads ONLY PUBLISHED; Admins read all
DROP POLICY IF EXISTS "Results: public read published or admin read all" ON public.event_results;
CREATE POLICY "Results: public read published or admin read all"
    ON public.event_results FOR SELECT
    USING (status = 'PUBLISHED' OR public.is_admin());

DROP POLICY IF EXISTS "Results: admin insert" ON public.event_results;
CREATE POLICY "Results: admin insert"
    ON public.event_results FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Results: admin update" ON public.event_results;
CREATE POLICY "Results: admin update"
    ON public.event_results FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Results: super admin delete" ON public.event_results;
CREATE POLICY "Results: super admin delete"
    ON public.event_results FOR DELETE
    USING (public.is_super_admin());

-- Result Entries: Public reads ONLY entries for published results
DROP POLICY IF EXISTS "Result Entries: public read published or admin read all" ON public.result_entries;
CREATE POLICY "Result Entries: public read published or admin read all"
    ON public.result_entries FOR SELECT
    USING (
        public.is_admin() OR 
        EXISTS (
            SELECT 1 FROM public.event_results er
            WHERE er.id = result_entries.event_result_id AND er.status = 'PUBLISHED'
        )
    );

DROP POLICY IF EXISTS "Result Entries: admin write" ON public.result_entries;
CREATE POLICY "Result Entries: admin write"
    ON public.result_entries FOR ALL
    USING (public.is_admin());

-- Result Participants: Group member attribution
DROP POLICY IF EXISTS "Result Participants: public read published or admin read all" ON public.result_participants;
CREATE POLICY "Result Participants: public read published or admin read all"
    ON public.result_participants FOR SELECT
    USING (
        public.is_admin() OR 
        EXISTS (
            SELECT 1 FROM public.result_entries re
            JOIN public.event_results er ON er.id = re.event_result_id
            WHERE re.id = result_participants.result_entry_id AND er.status = 'PUBLISHED'
        )
    );

DROP POLICY IF EXISTS "Result Participants: admin write" ON public.result_participants;
CREATE POLICY "Result Participants: admin write"
    ON public.result_participants FOR ALL
    USING (public.is_admin());

-- ==============================================================================
-- 10. POLICIES: Point Ledger
-- ==============================================================================
-- Public reads active points; Only Publisher or Super Admin can modify

DROP POLICY IF EXISTS "Point Ledger: public read active or admin read all" ON public.point_ledger;
CREATE POLICY "Point Ledger: public read active or admin read all"
    ON public.point_ledger FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Point Ledger: publisher write" ON public.point_ledger;
CREATE POLICY "Point Ledger: publisher write"
    ON public.point_ledger FOR ALL
    USING (public.is_publisher());

-- ==============================================================================
-- 11. POLICIES: Audit Logs
-- ==============================================================================
-- Strict compliance: Authenticated users can insert; Only Super Admin can read; IMMUTABLE (no updates, no deletes)

DROP POLICY IF EXISTS "Audit Logs: super admin select" ON public.audit_logs;
CREATE POLICY "Audit Logs: super admin select"
    ON public.audit_logs FOR SELECT
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "Audit Logs: admin insert" ON public.audit_logs;
CREATE POLICY "Audit Logs: admin insert"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Explicitly ensure NO UPDATE and NO DELETE policies exist on audit_logs
-- Rows in audit_logs are completely immutable
