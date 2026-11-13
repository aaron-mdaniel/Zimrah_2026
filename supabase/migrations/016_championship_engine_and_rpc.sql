-- ==============================================================================
-- ZIMRAH 2026 – Migration 016: Championship Engine, 5-Level Tie-Breaker & RPCs
-- ==============================================================================
-- Implements the core Championship Engine for ZIMRAH 2026.
-- Matches apps.championships.services.ChampionshipService
-- 
-- 1. Point Ledger constraints (prevent duplicate active awards)
-- 2. get_church_standings RPC (5-level tie-breaker, standard competition ranking)
-- 3. get_individual_standings RPC (Junior, Senior, Overall, 5-level tie-breaker)
-- 4. get_championship_live_summary RPC (Live statistics, top 3, latest results)
-- 5. get_church_event_breakdown & get_individual_event_breakdown RPCs
-- ==============================================================================

-- 1. Point Ledger Partial Unique Constraints
-- Guarantees that duplicate active point awards can never exist for a result entry
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_church_ledger 
ON public.point_ledger(result_entry_id, target) 
WHERE (target = 'CHURCH' AND is_active = TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_participant_ledger 
ON public.point_ledger(result_entry_id, participant_id, target) 
WHERE (target = 'INDIVIDUAL' AND is_active = TRUE AND participant_id IS NOT NULL);

-- Additional indexing for rapid championship leaderboard aggregation
CREATE INDEX IF NOT EXISTS idx_point_ledger_agg_church 
ON public.point_ledger(edition_id, target, is_active, church_id) 
INCLUDE (points, result_entry_id);

CREATE INDEX IF NOT EXISTS idx_point_ledger_agg_participant 
ON public.point_ledger(edition_id, target, is_active, participant_id) 
INCLUDE (points, result_entry_id);

-- 2. RPC Function: get_church_standings
-- Computes parish championship rankings from active Point Ledger records.
-- Enforces the 5-level tie-breaking hierarchy:
--   1. Total Points (DESC)
--   2. Count of 1st places (DESC)
--   3. Count of 2nd places (DESC)
--   4. Count of 3rd places (DESC)
--   5. Count of Grade A awards (DESC)
-- If all 5 criteria match: Assigns equal rank using Standard Competition Ranking (1, 2, 2, 4...)
-- Secondary ordering for deterministic display within tied ranks: Church Name (ASC).
CREATE OR REPLACE FUNCTION public.get_church_standings(
    p_edition_id UUID DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    rank BIGINT,
    is_tied BOOLEAN,
    church_id UUID,
    church_name VARCHAR,
    church_code VARCHAR,
    church_location VARCHAR,
    total_points DECIMAL(6, 2),
    first_places BIGINT,
    second_places BIGINT,
    third_places BIGINT,
    grade_a_count BIGINT,
    grade_b_count BIGINT,
    grade_c_count BIGINT,
    events_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_edition_id UUID;
BEGIN
    -- Determine target edition
    IF p_edition_id IS NOT NULL THEN
        v_target_edition_id := p_edition_id;
    ELSE
        SELECT id INTO v_target_edition_id 
        FROM public.editions 
        WHERE is_active = TRUE 
        ORDER BY year DESC 
        LIMIT 1;
    END IF;

    RETURN QUERY
    WITH church_stats AS (
        SELECT 
            c.id AS c_id,
            c.name AS c_name,
            c.code AS c_code,
            c.district AS c_district,
            COALESCE(SUM(pl.points), 0.00)::DECIMAL(6, 2) AS stat_total_points,
            COUNT(pl.id) FILTER (WHERE re.position = 1)::BIGINT AS stat_first_places,
            COUNT(pl.id) FILTER (WHERE re.position = 2)::BIGINT AS stat_second_places,
            COUNT(pl.id) FILTER (WHERE re.position = 3)::BIGINT AS stat_third_places,
            COUNT(pl.id) FILTER (WHERE re.grade = 'A')::BIGINT AS stat_grade_a,
            COUNT(pl.id) FILTER (WHERE re.grade = 'B')::BIGINT AS stat_grade_b,
            COUNT(pl.id) FILTER (WHERE re.grade = 'C')::BIGINT AS stat_grade_c,
            COUNT(DISTINCT pl.event_id)::BIGINT AS stat_events_count
        FROM public.churches c
        LEFT JOIN public.point_ledger pl ON pl.church_id = c.id 
            AND pl.target = 'CHURCH' 
            AND pl.is_active = TRUE 
            AND (v_target_edition_id IS NULL OR pl.edition_id = v_target_edition_id)
        LEFT JOIN public.result_entries re ON re.id = pl.result_entry_id
        WHERE c.is_active = TRUE
          AND (
              p_search IS NULL 
              OR trim(p_search) = '' 
              OR c.name ILIKE '%' || trim(p_search) || '%' 
              OR c.code ILIKE '%' || trim(p_search) || '%' 
              OR c.district ILIKE '%' || trim(p_search) || '%'
          )
        GROUP BY c.id, c.name, c.code, c.district
    ),
    ranked_churches AS (
        SELECT
            RANK() OVER (
                ORDER BY 
                    stat_total_points DESC,
                    stat_first_places DESC,
                    stat_second_places DESC,
                    stat_third_places DESC,
                    stat_grade_a DESC
            )::BIGINT AS calc_rank,
            (COUNT(*) OVER (
                PARTITION BY 
                    stat_total_points,
                    stat_first_places,
                    stat_second_places,
                    stat_third_places,
                    stat_grade_a
            ) > 1)::BOOLEAN AS calc_is_tied,
            c_id,
            c_name,
            c_code,
            c_district,
            stat_total_points,
            stat_first_places,
            stat_second_places,
            stat_third_places,
            stat_grade_a,
            stat_grade_b,
            stat_grade_c,
            stat_events_count
        FROM church_stats
    )
    SELECT 
        calc_rank AS rank,
        calc_is_tied AS is_tied,
        c_id AS church_id,
        c_name AS church_name,
        c_code AS church_code,
        c_district AS church_location,
        stat_total_points AS total_points,
        stat_first_places AS first_places,
        stat_second_places AS second_places,
        stat_third_places AS third_places,
        stat_grade_a AS grade_a_count,
        stat_grade_b AS grade_b_count,
        stat_grade_c AS grade_c_count,
        stat_events_count AS events_count
    FROM ranked_churches
    ORDER BY 
        calc_rank ASC,
        stat_total_points DESC,
        stat_first_places DESC,
        stat_second_places DESC,
        stat_third_places DESC,
        stat_grade_a DESC,
        c_name ASC;
END;
$$;

-- 3. RPC Function: get_individual_standings
-- Computes individual contestant championship rankings (Kalathilakam / Kalaprathibha)
-- Supports Overall, Junior, and Senior divisions with 5-level tie-breaking.
-- Optional p_only_with_points filters for contestants with > 0 points before ranking.
CREATE OR REPLACE FUNCTION public.get_individual_standings(
    p_edition_id UUID DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_only_with_points BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    rank BIGINT,
    is_tied BOOLEAN,
    participant_id UUID,
    participant_name VARCHAR,
    chest_number VARCHAR,
    category VARCHAR,
    category_display TEXT,
    gender VARCHAR,
    church_id UUID,
    church_name VARCHAR,
    church_code VARCHAR,
    total_points DECIMAL(6, 2),
    first_places BIGINT,
    second_places BIGINT,
    third_places BIGINT,
    grade_a_count BIGINT,
    grade_b_count BIGINT,
    grade_c_count BIGINT,
    events_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_edition_id UUID;
    v_filter_category TEXT;
BEGIN
    -- Determine target edition
    IF p_edition_id IS NOT NULL THEN
        v_target_edition_id := p_edition_id;
    ELSE
        SELECT id INTO v_target_edition_id 
        FROM public.editions 
        WHERE is_active = TRUE 
        ORDER BY year DESC 
        LIMIT 1;
    END IF;

    -- Clean category filter
    IF p_category IS NOT NULL AND trim(p_category) <> '' AND upper(trim(p_category)) <> 'ALL' THEN
        v_filter_category := upper(trim(p_category));
    ELSE
        v_filter_category := NULL;
    END IF;

    RETURN QUERY
    WITH participant_stats AS (
        SELECT 
            p.id AS p_id,
            p.name AS p_name,
            p.chest_number AS p_chest,
            p.age_category AS p_cat,
            CASE 
                WHEN p.age_category = 'JUNIOR' THEN 'Junior' 
                WHEN p.age_category = 'SENIOR' THEN 'Senior'
                ELSE 'Open'
            END::TEXT AS p_cat_display,
            p.gender AS p_gender,
            c.id AS c_id,
            c.name AS c_name,
            c.code AS c_code,
            COALESCE(SUM(pl.points), 0.00)::DECIMAL(6, 2) AS stat_total_points,
            COUNT(pl.id) FILTER (WHERE re.position = 1)::BIGINT AS stat_first_places,
            COUNT(pl.id) FILTER (WHERE re.position = 2)::BIGINT AS stat_second_places,
            COUNT(pl.id) FILTER (WHERE re.position = 3)::BIGINT AS stat_third_places,
            COUNT(pl.id) FILTER (WHERE re.grade = 'A')::BIGINT AS stat_grade_a,
            COUNT(pl.id) FILTER (WHERE re.grade = 'B')::BIGINT AS stat_grade_b,
            COUNT(pl.id) FILTER (WHERE re.grade = 'C')::BIGINT AS stat_grade_c,
            COUNT(DISTINCT pl.event_id)::BIGINT AS stat_events_count
        FROM public.participants p
        JOIN public.churches c ON c.id = p.church_id
        LEFT JOIN public.point_ledger pl ON pl.participant_id = p.id 
            AND pl.target = 'INDIVIDUAL' 
            AND pl.is_active = TRUE 
            AND (v_target_edition_id IS NULL OR pl.edition_id = v_target_edition_id)
        LEFT JOIN public.result_entries re ON re.id = pl.result_entry_id
        WHERE (v_target_edition_id IS NULL OR p.edition_id = v_target_edition_id)
          AND (v_filter_category IS NULL OR p.age_category = v_filter_category)
          AND (
              p_search IS NULL 
              OR trim(p_search) = '' 
              OR p.name ILIKE '%' || trim(p_search) || '%' 
              OR p.chest_number ILIKE '%' || trim(p_search) || '%' 
              OR c.name ILIKE '%' || trim(p_search) || '%'
              OR c.code ILIKE '%' || trim(p_search) || '%'
          )
        GROUP BY p.id, p.name, p.chest_number, p.age_category, p.gender, c.id, c.name, c.code
    ),
    filtered_stats AS (
        SELECT *
        FROM participant_stats
        WHERE (NOT p_only_with_points OR stat_total_points > 0.00)
    ),
    ranked_participants AS (
        SELECT
            RANK() OVER (
                ORDER BY 
                    stat_total_points DESC,
                    stat_first_places DESC,
                    stat_second_places DESC,
                    stat_third_places DESC,
                    stat_grade_a DESC
            )::BIGINT AS calc_rank,
            (COUNT(*) OVER (
                PARTITION BY 
                    stat_total_points,
                    stat_first_places,
                    stat_second_places,
                    stat_third_places,
                    stat_grade_a
            ) > 1)::BOOLEAN AS calc_is_tied,
            p_id,
            p_name,
            p_chest,
            p_cat,
            p_cat_display,
            p_gender,
            c_id,
            c_name,
            c_code,
            stat_total_points,
            stat_first_places,
            stat_second_places,
            stat_third_places,
            stat_grade_a,
            stat_grade_b,
            stat_grade_c,
            stat_events_count
        FROM filtered_stats
    )
    SELECT 
        calc_rank AS rank,
        calc_is_tied AS is_tied,
        p_id AS participant_id,
        p_name AS participant_name,
        p_chest AS chest_number,
        p_cat AS category,
        p_cat_display AS category_display,
        p_gender AS gender,
        c_id AS church_id,
        c_name AS church_name,
        c_code AS church_code,
        stat_total_points AS total_points,
        stat_first_places AS first_places,
        stat_second_places AS second_places,
        stat_third_places AS third_places,
        stat_grade_a AS grade_a_count,
        stat_grade_b AS grade_b_count,
        stat_grade_c AS grade_c_count,
        stat_events_count AS events_count
    FROM ranked_participants
    ORDER BY 
        calc_rank ASC,
        stat_total_points DESC,
        stat_first_places DESC,
        stat_second_places DESC,
        stat_third_places DESC,
        stat_grade_a DESC,
        p_chest ASC;
END;
$$;

-- 4. RPC Function: get_championship_live_summary
-- Generates live statistics for header ticker, polling widget, and home dashboard.
-- Returns total events, published results, completion %, top 3 churches, top 3 individuals, and latest winners.
CREATE OR REPLACE FUNCTION public.get_championship_live_summary(
    p_edition_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_edition_id UUID;
    v_edition_name TEXT;
    v_total_events INTEGER := 0;
    v_published_results INTEGER := 0;
    v_pending_results INTEGER := 0;
    v_completion_pct NUMERIC := 0.0;
    v_top_churches JSONB := '[]'::jsonb;
    v_top_individuals JSONB := '[]'::jsonb;
    v_latest_results JSONB := '[]'::jsonb;
BEGIN
    -- Determine target edition
    IF p_edition_id IS NOT NULL THEN
        v_target_edition_id := p_edition_id;
        SELECT name INTO v_edition_name FROM public.editions WHERE id = v_target_edition_id;
    ELSE
        SELECT id, name INTO v_target_edition_id, v_edition_name 
        FROM public.editions 
        WHERE is_active = TRUE 
        ORDER BY year DESC 
        LIMIT 1;
    END IF;

    -- Event metrics
    SELECT COUNT(*) INTO v_total_events
    FROM public.events
    WHERE (v_target_edition_id IS NULL OR edition_id = v_target_edition_id);

    SELECT COUNT(*) INTO v_published_results
    FROM public.event_results er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.status = 'PUBLISHED'
      AND (v_target_edition_id IS NULL OR e.edition_id = v_target_edition_id);

    v_pending_results := GREATEST(0, v_total_events - v_published_results);
    IF v_total_events > 0 THEN
        v_completion_pct := round((v_published_results::numeric / v_total_events::numeric * 100), 1);
    ELSE
        v_completion_pct := 0.0;
    END IF;

    -- Top 3 Churches
    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_top_churches
    FROM (
        SELECT *
        FROM public.get_church_standings(v_target_edition_id, NULL)
        LIMIT 3
    ) t;

    -- Top 3 Individuals (only contestants with points)
    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_top_individuals
    FROM (
        SELECT *
        FROM public.get_individual_standings(v_target_edition_id, NULL, NULL, TRUE)
        LIMIT 3
    ) t;

    -- Latest 3 Published Results with Winner Info
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_latest_results
    FROM (
        SELECT 
            e.code,
            e.name,
            e.name_malayalam,
            er.published_at,
            COALESCE(
                (
                    SELECT re.participant_name || ' (' || c.code || ')'
                    FROM public.result_entries re
                    JOIN public.churches c ON c.id = re.church_id
                    WHERE re.event_result_id = er.id AND re.position = 1
                    LIMIT 1
                ),
                'Completed'
            ) AS winner
        FROM public.event_results er
        JOIN public.events e ON e.id = er.event_id
        WHERE er.status = 'PUBLISHED'
          AND (v_target_edition_id IS NULL OR e.edition_id = v_target_edition_id)
        ORDER BY er.published_at DESC NULLS LAST
        LIMIT 3
    ) r;

    RETURN jsonb_build_object(
        'edition_name', COALESCE(v_edition_name, 'ZIMRAH 2026'),
        'total_events', v_total_events,
        'published_results', v_published_results,
        'pending_results', v_pending_results,
        'completion_pct', v_completion_pct,
        'top_churches', v_top_churches,
        'top_individuals', v_top_individuals,
        'latest_results', v_latest_results
    );
END;
$$;

-- 5. RPC Function: get_church_event_breakdown
-- Fetches event-wise point contributions for a specific church.
CREATE OR REPLACE FUNCTION public.get_church_event_breakdown(
    p_church_id UUID,
    p_edition_id UUID DEFAULT NULL
)
RETURNS TABLE (
    ledger_id UUID,
    event_id UUID,
    event_code VARCHAR,
    event_name VARCHAR,
    event_name_malayalam VARCHAR,
    event_type VARCHAR,
    participant_name VARCHAR,
    chest_number VARCHAR,
    "position" SMALLINT,
    grade VARCHAR,
    points DECIMAL(6, 2),
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.id AS ledger_id,
        e.id AS event_id,
        e.code AS event_code,
        e.name AS event_name,
        e.name_malayalam AS event_name_malayalam,
        e.event_type AS event_type,
        re.participant_name,
        re.chest_number,
        re.position AS "position",
        re.grade,
        pl.points,
        pl.created_at
    FROM public.point_ledger pl
    JOIN public.events e ON e.id = pl.event_id
    JOIN public.result_entries re ON re.id = pl.result_entry_id
    WHERE pl.church_id = p_church_id
      AND pl.target = 'CHURCH'
      AND pl.is_active = TRUE
      AND (p_edition_id IS NULL OR pl.edition_id = p_edition_id)
    ORDER BY pl.created_at DESC, e.code ASC;
END;
$$;

-- 6. RPC Function: get_individual_event_breakdown
-- Fetches event-wise point contributions for a specific contestant.
CREATE OR REPLACE FUNCTION public.get_individual_event_breakdown(
    p_participant_id UUID,
    p_edition_id UUID DEFAULT NULL
)
RETURNS TABLE (
    ledger_id UUID,
    event_id UUID,
    event_code VARCHAR,
    event_name VARCHAR,
    event_name_malayalam VARCHAR,
    event_type VARCHAR,
    "position" SMALLINT,
    grade VARCHAR,
    role VARCHAR,
    points DECIMAL(6, 2),
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.id AS ledger_id,
        e.id AS event_id,
        e.code AS event_code,
        e.name AS event_name,
        e.name_malayalam AS event_name_malayalam,
        e.event_type AS event_type,
        re.position AS "position",
        re.grade,
        COALESCE(rp.role, '')::VARCHAR AS role,
        pl.points,
        pl.created_at
    FROM public.point_ledger pl
    JOIN public.events e ON e.id = pl.event_id
    JOIN public.result_entries re ON re.id = pl.result_entry_id
    LEFT JOIN public.result_participants rp ON rp.result_entry_id = re.id AND rp.participant_id = p_participant_id
    WHERE pl.participant_id = p_participant_id
      AND pl.target = 'INDIVIDUAL'
      AND pl.is_active = TRUE
      AND (p_edition_id IS NULL OR pl.edition_id = p_edition_id)
    ORDER BY pl.created_at DESC, e.code ASC;
END;
$$;

-- 7. Permissions: Grant execute access to anon & authenticated
GRANT EXECUTE ON FUNCTION public.get_church_standings(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_individual_standings(UUID, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_championship_live_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_church_event_breakdown(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_individual_event_breakdown(UUID, UUID) TO anon, authenticated;
