-- ==============================================================================
-- ZIMRAH 2026 – Phase 8: Cache Invalidation Outbox & Performance Tuning Migration
-- CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement
-- ==============================================================================
-- Preserves generation-based caching architecture (ADR-007)
-- Implements PostgreSQL transactional outbox for reliable cache invalidation
-- Optimizes search and aggregation query plans via GIN trigram indexes
-- ==============================================================================

-- 1. Enable pg_trgm extension for accelerated substring/chest number search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Authoritative Database Cache Generation State Table
CREATE TABLE IF NOT EXISTS public.cache_generation_state (
    edition_id UUID PRIMARY KEY REFERENCES public.editions(id) ON DELETE CASCADE,
    generation BIGINT NOT NULL DEFAULT 1,
    last_invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reason TEXT DEFAULT 'INITIAL_SETUP'
);

-- Seed generation state for all existing editions
INSERT INTO public.cache_generation_state (edition_id, generation, last_invalidated_at, last_reason)
SELECT id, 1, NOW(), 'INITIAL_SETUP'
FROM public.editions
ON CONFLICT (edition_id) DO NOTHING;

-- 3. Cache Invalidation Outbox Table (Transactional Outbox Pattern)
CREATE TABLE IF NOT EXISTS public.cache_invalidation_outbox (
    id BIGSERIAL PRIMARY KEY,
    edition_id UUID REFERENCES public.editions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    affected_namespace VARCHAR(50) NOT NULL DEFAULT '*',
    payload JSONB DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cache_outbox_pending 
ON public.cache_invalidation_outbox (processed, created_at)
WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_cache_outbox_edition 
ON public.cache_invalidation_outbox (edition_id, created_at DESC);

-- 4. Central Invalidation Function (Executed atomically inside DB transactions)
CREATE OR REPLACE FUNCTION public.fn_trigger_cache_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_edition_id UUID;
    v_event_type VARCHAR(50);
    v_namespace VARCHAR(50) := '*';
    v_payload JSONB := '{}'::jsonb;
    v_new_gen BIGINT;
BEGIN
    -- Determine target edition and event context
    IF TG_TABLE_NAME = 'event_results' THEN
        -- Only invalidate if status changed to/from PUBLISHED or published result was mutated
        IF (TG_OP = 'UPDATE' AND (OLD.status = 'PUBLISHED' OR NEW.status = 'PUBLISHED')) OR
           (TG_OP = 'INSERT' AND NEW.status = 'PUBLISHED') OR
           (TG_OP = 'DELETE' AND OLD.status = 'PUBLISHED') THEN
            
            SELECT e.edition_id INTO v_edition_id
            FROM public.events e
            WHERE e.id = COALESCE(NEW.event_id, OLD.event_id);
            
            v_event_type := CASE 
                WHEN TG_OP = 'UPDATE' AND OLD.status != 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN 'RESULT_PUBLISHED'
                WHEN TG_OP = 'UPDATE' AND OLD.status = 'PUBLISHED' AND NEW.status != 'PUBLISHED' THEN 'RESULT_UNPUBLISHED'
                WHEN TG_OP = 'UPDATE' AND OLD.status = 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN 'RESULT_CORRECTED'
                ELSE 'RESULT_CHANGED'
            END;
            v_namespace := 'championship';
            v_payload := jsonb_build_object(
                'event_result_id', COALESCE(NEW.id, OLD.id),
                'event_id', COALESCE(NEW.event_id, OLD.event_id),
                'old_status', CASE WHEN TG_OP != 'INSERT' THEN OLD.status ELSE NULL END,
                'new_status', CASE WHEN TG_OP != 'DELETE' THEN NEW.status ELSE NULL END
            );
        ELSE
            RETURN COALESCE(NEW, OLD);
        END IF;

    ELSIF TG_TABLE_NAME = 'churches' THEN
        SELECT id INTO v_edition_id FROM public.editions WHERE is_active = TRUE LIMIT 1;
        v_event_type := 'CHURCH_' || TG_OP;
        v_namespace := 'master_data';
        v_payload := jsonb_build_object('church_id', COALESCE(NEW.id, OLD.id), 'code', COALESCE(NEW.code, OLD.code));

    ELSIF TG_TABLE_NAME = 'participants' THEN
        v_edition_id := COALESCE(NEW.edition_id, OLD.edition_id);
        v_event_type := 'PARTICIPANT_' || TG_OP;
        v_namespace := 'master_data';
        v_payload := jsonb_build_object('participant_id', COALESCE(NEW.id, OLD.id), 'chest_number', COALESCE(NEW.chest_number, OLD.chest_number));

    ELSIF TG_TABLE_NAME = 'events' THEN
        v_edition_id := COALESCE(NEW.edition_id, OLD.edition_id);
        v_event_type := 'EVENT_' || TG_OP;
        v_namespace := 'events';
        v_payload := jsonb_build_object('event_id', COALESCE(NEW.id, OLD.id), 'code', COALESCE(NEW.code, OLD.code));

    ELSIF TG_TABLE_NAME = 'registrations' THEN
        v_edition_id := COALESCE(NEW.edition_id, OLD.edition_id);
        v_event_type := 'REGISTRATION_' || TG_OP;
        v_namespace := 'registrations';
        v_payload := jsonb_build_object('registration_id', COALESCE(NEW.id, OLD.id));
    END IF;

    -- Ensure edition exists
    IF v_edition_id IS NULL THEN
        SELECT id INTO v_edition_id FROM public.editions WHERE is_active = TRUE LIMIT 1;
    END IF;

    IF v_edition_id IS NOT NULL THEN
        -- Atomically advance generation counter in DB state
        INSERT INTO public.cache_generation_state (edition_id, generation, last_invalidated_at, last_reason)
        VALUES (v_edition_id, 2, NOW(), v_event_type)
        ON CONFLICT (edition_id) DO UPDATE
        SET generation = public.cache_generation_state.generation + 1,
            last_invalidated_at = NOW(),
            last_reason = v_event_type
        RETURNING generation INTO v_new_gen;

        -- Record outbox event for reliable asynchronous delivery / Redis synchronization
        INSERT INTO public.cache_invalidation_outbox (
            edition_id,
            event_type,
            affected_namespace,
            payload,
            created_at
        ) VALUES (
            v_edition_id,
            v_event_type,
            v_namespace,
            jsonb_set(v_payload, '{generation}', to_jsonb(v_new_gen)),
            NOW()
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Attach Triggers to Relevant Master & Result Tables
DROP TRIGGER IF EXISTS trg_cache_inval_event_results ON public.event_results;
CREATE TRIGGER trg_cache_inval_event_results
AFTER INSERT OR UPDATE OR DELETE ON public.event_results
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_cache_invalidation();

DROP TRIGGER IF EXISTS trg_cache_inval_churches ON public.churches;
CREATE TRIGGER trg_cache_inval_churches
AFTER INSERT OR UPDATE OR DELETE ON public.churches
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_cache_invalidation();

DROP TRIGGER IF EXISTS trg_cache_inval_participants ON public.participants;
CREATE TRIGGER trg_cache_inval_participants
AFTER INSERT OR UPDATE OR DELETE ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_cache_invalidation();

DROP TRIGGER IF EXISTS trg_cache_inval_events ON public.events;
CREATE TRIGGER trg_cache_inval_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_cache_invalidation();

DROP TRIGGER IF EXISTS trg_cache_inval_registrations ON public.registrations;
CREATE TRIGGER trg_cache_inval_registrations
AFTER INSERT OR UPDATE OR DELETE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_cache_invalidation();

-- 6. RPC: Get Authoritative Database Cache Generation
CREATE OR REPLACE FUNCTION public.get_cache_generation(
    p_edition_id UUID DEFAULT NULL
)
RETURNS TABLE (
    edition_id UUID,
    generation BIGINT,
    last_invalidated_at TIMESTAMPTZ,
    last_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_edition_id UUID := p_edition_id;
BEGIN
    IF v_edition_id IS NULL THEN
        SELECT id INTO v_edition_id FROM public.editions WHERE is_active = TRUE LIMIT 1;
    END IF;

    RETURN QUERY
    SELECT 
        s.edition_id,
        s.generation,
        s.last_invalidated_at,
        s.last_reason
    FROM public.cache_generation_state s
    WHERE s.edition_id = v_edition_id;

    -- If no record yet, insert initial state
    IF NOT FOUND AND v_edition_id IS NOT NULL THEN
        INSERT INTO public.cache_generation_state (edition_id, generation, last_invalidated_at, last_reason)
        VALUES (v_edition_id, 1, NOW(), 'INITIAL_SETUP')
        ON CONFLICT (edition_id) DO NOTHING;

        RETURN QUERY
        SELECT 
            s.edition_id,
            s.generation,
            s.last_invalidated_at,
            s.last_reason
        FROM public.cache_generation_state s
        WHERE s.edition_id = v_edition_id;
    END IF;
END;
$$;

-- 7. RPC: Drain and Mark Cache Invalidation Outbox Records
CREATE OR REPLACE FUNCTION public.drain_cache_invalidation_outbox(
    p_batch_size INT DEFAULT 50
)
RETURNS TABLE (
    id BIGINT,
    edition_id UUID,
    event_type VARCHAR(50),
    affected_namespace VARCHAR(50),
    payload JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH pending AS (
        SELECT o.id
        FROM public.cache_invalidation_outbox o
        WHERE o.processed = FALSE
        ORDER BY o.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.cache_invalidation_outbox o
        SET processed = TRUE,
            processed_at = NOW()
        FROM pending p
        WHERE o.id = p.id
        RETURNING o.id, o.edition_id, o.event_type, o.affected_namespace, o.payload, o.created_at
    )
    SELECT * FROM updated;
END;
$$;

-- 8. GIN Trigram Indexes for Substring & Full-Text Search Optimization
CREATE INDEX IF NOT EXISTS idx_trgm_participants_name 
ON public.participants USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_participants_chest 
ON public.participants USING gin (chest_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_churches_name 
ON public.churches USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_churches_code 
ON public.churches USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_events_name 
ON public.events USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_events_code 
ON public.events USING gin (code gin_trgm_ops);

-- 9. Row Level Security (RLS) Policies on Cache State & Outbox
ALTER TABLE public.cache_generation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_invalidation_outbox ENABLE ROW LEVEL SECURITY;

-- Allow public read of generation state
DROP POLICY IF EXISTS p_public_read_cache_gen ON public.cache_generation_state;
CREATE POLICY p_public_read_cache_gen ON public.cache_generation_state
FOR SELECT TO anon, authenticated
USING (TRUE);

-- Super Admin can manage cache state directly
DROP POLICY IF EXISTS p_super_admin_manage_cache_gen ON public.cache_generation_state;
CREATE POLICY p_super_admin_manage_cache_gen ON public.cache_generation_state
FOR ALL TO authenticated
USING (public.is_super_admin());

-- Only authenticated admins can inspect outbox
DROP POLICY IF EXISTS p_admin_read_cache_outbox ON public.cache_invalidation_outbox;
CREATE POLICY p_admin_read_cache_outbox ON public.cache_invalidation_outbox
FOR SELECT TO authenticated
USING (public.is_admin());
