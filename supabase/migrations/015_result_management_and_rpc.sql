-- ==============================================================================
-- ZIMRAH 2026 – Migration 015: Result Management Engine, RPC Functions & Lifecycle
-- ==============================================================================

-- 1. Ensure Total Points Calculation Trigger is Robust
-- Ensures Total Points = Grade Points + Position Points on every insert/update
CREATE OR REPLACE FUNCTION public.trg_fn_calculate_result_entry_total_points()
RETURNS TRIGGER AS $$
BEGIN
    NEW.grade_points := COALESCE(NEW.grade_points, 0.00);
    NEW.position_points := COALESCE(NEW.position_points, 0.00);
    NEW.total_points := NEW.grade_points + NEW.position_points;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_total_points ON public.result_entries;
CREATE TRIGGER trg_calculate_total_points
    BEFORE INSERT OR UPDATE
    ON public.result_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_calculate_result_entry_total_points();

-- 2. RPC Function: Save Result Draft (Atomic Transaction)
-- Saves or updates event results in DRAFT state.
-- Recalculates total_points securely on the backend.
CREATE OR REPLACE FUNCTION public.save_result_draft(
    p_event_id UUID,
    p_entries JSONB,
    p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN;
    v_result_id UUID;
    v_current_status TEXT;
    v_entry JSONB;
    v_entry_id UUID;
    v_chest TEXT;
    v_name TEXT;
    v_church_id UUID;
    v_part_id UUID;
    v_pos SMALLINT;
    v_grade TEXT;
    v_gp DECIMAL(5, 2);
    v_pp DECIMAL(5, 2);
    v_rem TEXT;
    v_saved_entry_ids UUID[] := ARRAY[]::UUID[];
    v_is_new BOOLEAN := FALSE;
    v_member JSONB;
    v_m_part_id UUID;
    v_m_role TEXT;
    v_m_pts DECIMAL(5, 2);
BEGIN
    -- Check permissions: RESULT_ADMIN, PUBLISHER, or SUPER_ADMIN
    v_caller_id := auth.uid();
    v_is_admin := public.is_admin();
    IF NOT v_is_admin AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can save result drafts.';
    END IF;

    -- Check if Event exists
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
        RAISE EXCEPTION 'Event not found: %', p_event_id;
    END IF;

    -- Get or lock existing EventResult
    SELECT id, status INTO v_result_id, v_current_status
    FROM public.event_results
    WHERE event_id = p_event_id
    FOR UPDATE;

    IF v_result_id IS NOT NULL AND v_current_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'This event result is already published. Use score correction to modify published results.';
    END IF;

    IF v_result_id IS NULL THEN
        INSERT INTO public.event_results (
            event_id,
            status,
            created_by,
            notes
        ) VALUES (
            p_event_id,
            'DRAFT',
            v_caller_id,
            COALESCE(p_notes, '')
        ) RETURNING id INTO v_result_id;
        v_is_new := TRUE;
    ELSE
        UPDATE public.event_results
        SET notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE id = v_result_id;
    END IF;

    -- Process entries
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        v_chest := trim(COALESCE(v_entry->>'chest_number', ''));
        v_name := trim(COALESCE(v_entry->>'participant_name', ''));
        
        IF v_chest = '' OR v_name = '' THEN
            RAISE EXCEPTION 'Validation Error: Chest number and participant name are required for every entry.';
        END IF;

        v_church_id := (v_entry->>'church_id')::UUID;
        IF v_church_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.churches WHERE id = v_church_id) THEN
            RAISE EXCEPTION 'Validation Error: Church ID is invalid or missing for contestant %.', v_chest;
        END IF;

        v_part_id := NULLIF(v_entry->>'participant_id', '')::UUID;
        
        IF v_entry->>'position' IS NOT NULL AND v_entry->>'position' != '' AND v_entry->>'position' != 'null' THEN
            v_pos := (v_entry->>'position')::SMALLINT;
            IF v_pos NOT IN (1, 2, 3) THEN
                RAISE EXCEPTION 'Validation Error: Position must be 1, 2, or 3 (got: %).', v_pos;
            END IF;
        ELSE
            v_pos := NULL;
        END IF;

        v_grade := upper(trim(COALESCE(v_entry->>'grade', '')));
        IF v_grade NOT IN ('', 'A', 'B', 'C') THEN
            RAISE EXCEPTION 'Validation Error: Grade must be A, B, C, or empty (got: %).', v_grade;
        END IF;

        v_gp := round(COALESCE((v_entry->>'grade_points')::NUMERIC, 0.00), 2)::DECIMAL(5, 2);
        v_pp := round(COALESCE((v_entry->>'position_points')::NUMERIC, 0.00), 2)::DECIMAL(5, 2);
        
        IF v_gp < 0 OR v_pp < 0 THEN
            RAISE EXCEPTION 'Validation Error: Points cannot be negative.';
        END IF;

        v_rem := trim(COALESCE(v_entry->>'remarks', ''));
        v_entry_id := NULLIF(v_entry->>'id', '')::UUID;

        -- Check if updating existing entry or inserting new
        IF v_entry_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.result_entries WHERE id = v_entry_id AND event_result_id = v_result_id) THEN
            UPDATE public.result_entries
            SET position = v_pos,
                chest_number = v_chest,
                participant_name = v_name,
                church_id = v_church_id,
                participant_id = v_part_id,
                grade = v_grade,
                grade_points = v_gp,
                position_points = v_pp,
                total_points = v_gp + v_pp,
                remarks = v_rem,
                updated_at = now()
            WHERE id = v_entry_id;
        ELSE
            INSERT INTO public.result_entries (
                event_result_id,
                position,
                chest_number,
                participant_name,
                church_id,
                participant_id,
                grade,
                grade_points,
                position_points,
                total_points,
                remarks
            ) VALUES (
                v_result_id,
                v_pos,
                v_chest,
                v_name,
                v_church_id,
                v_part_id,
                v_grade,
                v_gp,
                v_pp,
                v_gp + v_pp,
                v_rem
            ) RETURNING id INTO v_entry_id;
        END IF;

        v_saved_entry_ids := array_append(v_saved_entry_ids, v_entry_id);

        -- Process group members if present
        IF v_entry ? 'group_members' AND jsonb_typeof(v_entry->'group_members') = 'array' THEN
            DELETE FROM public.result_participants WHERE result_entry_id = v_entry_id;
            FOR v_member IN SELECT * FROM jsonb_array_elements(v_entry->'group_members')
            LOOP
                v_m_part_id := NULLIF(v_member->>'participant_id', '')::UUID;
                v_m_role := trim(COALESCE(v_member->>'role', ''));
                v_m_pts := round(COALESCE((v_member->>'points_allocated')::NUMERIC, 0.00), 2)::DECIMAL(5, 2);
                
                IF v_m_part_id IS NOT NULL THEN
                    INSERT INTO public.result_participants (
                        result_entry_id,
                        participant_id,
                        role,
                        points_allocated
                    ) VALUES (
                        v_entry_id,
                        v_m_part_id,
                        v_m_role,
                        v_m_pts
                    ) ON CONFLICT (result_entry_id, participant_id) 
                    DO UPDATE SET role = EXCLUDED.role, points_allocated = EXCLUDED.points_allocated;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- Delete removed entries
    DELETE FROM public.result_entries
    WHERE event_result_id = v_result_id AND NOT (id = ANY(v_saved_entry_ids));

    -- Audit log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        model_name,
        object_id,
        object_repr,
        changes
    ) VALUES (
        v_caller_id,
        CASE WHEN v_is_new THEN 'RESULT_DRAFT_CREATED' ELSE 'RESULT_DRAFT_UPDATED' END,
        'EventResult',
        v_result_id::text,
        (SELECT code || ' - ' || name FROM public.events WHERE id = p_event_id),
        jsonb_build_object(
            'status', 'DRAFT',
            'entries_count', coalesce(array_length(v_saved_entry_ids, 1), 0),
            'notes', p_notes
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'event_result_id', v_result_id,
        'entries_count', coalesce(array_length(v_saved_entry_ids, 1), 0)
    );
END;
$$;

-- 3. RPC Function: Publish Result (Atomic Ledger Integration)
-- Publishes verified result entries.
-- Generates immutable active Point Ledger records for Church and Individual standings.
CREATE OR REPLACE FUNCTION public.publish_result(
    p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_publisher BOOLEAN;
    v_result_id UUID;
    v_status TEXT;
    v_edition_id UUID;
    v_event_type TEXT;
    v_contrib_indiv BOOLEAN;
    v_entry RECORD;
    v_rp RECORD;
    v_entries_count INTEGER := 0;
    v_ledger_count INTEGER := 0;
    v_event_code TEXT;
    v_pub_at TIMESTAMPTZ;
BEGIN
    -- Check permissions: Only SUPER_ADMIN and PUBLISHER can publish
    v_caller_id := auth.uid();
    v_is_publisher := public.is_publisher();
    IF NOT v_is_publisher AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN and PUBLISHER roles can publish results.';
    END IF;

    -- Lock EventResult
    SELECT er.id, er.status, e.id, e.code, e.edition_id, e.event_type, e.contributes_to_individual
    INTO v_result_id, v_status, p_event_id, v_event_code, v_edition_id, v_event_type, v_contrib_indiv
    FROM public.event_results er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.event_id = p_event_id
    FOR UPDATE;

    IF v_result_id IS NULL THEN
        RAISE EXCEPTION 'Result not found: No result draft exists for event %.', p_event_id;
    END IF;

    IF v_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'This event result is already published.';
    END IF;

    SELECT COUNT(*) INTO v_entries_count
    FROM public.result_entries
    WHERE event_result_id = v_result_id;

    IF v_entries_count = 0 THEN
        RAISE EXCEPTION 'Cannot publish an event result with zero entries.';
    END IF;

    -- Deactivate any legacy ledger entries for this result
    UPDATE public.point_ledger
    SET is_active = FALSE
    WHERE result_entry_id IN (
        SELECT id FROM public.result_entries WHERE event_result_id = v_result_id
    );

    -- Generate fresh active Point Ledger records
    FOR v_entry IN 
        SELECT id, church_id, participant_id, total_points 
        FROM public.result_entries 
        WHERE event_result_id = v_result_id
    LOOP
        IF v_entry.total_points > 0.00 THEN
            -- 1. Church Championship Point Ledger (awarded once per entry)
            INSERT INTO public.point_ledger (
                edition_id,
                result_entry_id,
                event_id,
                church_id,
                participant_id,
                target,
                points,
                is_active
            ) VALUES (
                v_edition_id,
                v_entry.id,
                p_event_id,
                v_entry.church_id,
                NULL,
                'CHURCH',
                v_entry.total_points,
                TRUE
            );
            v_ledger_count := v_ledger_count + 1;

            -- 2. Individual Championship Point Ledger
            IF v_event_type = 'INDIVIDUAL' THEN
                IF v_contrib_indiv AND v_entry.participant_id IS NOT NULL THEN
                    INSERT INTO public.point_ledger (
                        edition_id,
                        result_entry_id,
                        event_id,
                        church_id,
                        participant_id,
                        target,
                        points,
                        is_active
                    ) VALUES (
                        v_edition_id,
                        v_entry.id,
                        p_event_id,
                        v_entry.church_id,
                        v_entry.participant_id,
                        'INDIVIDUAL',
                        v_entry.total_points,
                        TRUE
                    );
                    v_ledger_count := v_ledger_count + 1;
                END IF;
            ELSE
                -- Group Event: credit individual points only if explicitly allocated
                FOR v_rp IN 
                    SELECT participant_id, points_allocated 
                    FROM public.result_participants 
                    WHERE result_entry_id = v_entry.id AND points_allocated > 0.00
                LOOP
                    INSERT INTO public.point_ledger (
                        edition_id,
                        result_entry_id,
                        event_id,
                        church_id,
                        participant_id,
                        target,
                        points,
                        is_active
                    ) VALUES (
                        v_edition_id,
                        v_entry.id,
                        p_event_id,
                        v_entry.church_id,
                        v_rp.participant_id,
                        'INDIVIDUAL',
                        v_rp.points_allocated,
                        TRUE
                    );
                    v_ledger_count := v_ledger_count + 1;
                END LOOP;
            END IF;
        END IF;
    END LOOP;

    -- Update EventResult to PUBLISHED
    v_pub_at := now();
    UPDATE public.event_results
    SET status = 'PUBLISHED',
        published_by = v_caller_id,
        published_at = v_pub_at,
        updated_at = v_pub_at
    WHERE id = v_result_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        model_name,
        object_id,
        object_repr,
        changes
    ) VALUES (
        v_caller_id,
        'RESULT_PUBLISHED',
        'EventResult',
        v_result_id::text,
        'Result for ' || v_event_code,
        jsonb_build_object(
            'status', jsonb_build_object('old', 'DRAFT', 'new', 'PUBLISHED'),
            'entries_published', v_entries_count,
            'ledger_records_created', v_ledger_count
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'event_result_id', v_result_id,
        'status', 'PUBLISHED',
        'published_at', v_pub_at,
        'entries_count', v_entries_count,
        'ledger_records_created', v_ledger_count
    );
END;
$$;

-- 4. RPC Function: Unpublish Result (Revert to DRAFT and Deactivate Ledger)
CREATE OR REPLACE FUNCTION public.unpublish_result(
    p_event_id UUID,
    p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_publisher BOOLEAN;
    v_result_id UUID;
    v_status TEXT;
    v_event_code TEXT;
    v_deactivated_count INTEGER := 0;
    v_prev_pub_at TIMESTAMPTZ;
BEGIN
    v_caller_id := auth.uid();
    v_is_publisher := public.is_publisher();
    IF NOT v_is_publisher AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN and PUBLISHER roles can unpublish results.';
    END IF;

    -- Lock EventResult
    SELECT er.id, er.status, e.code, er.published_at
    INTO v_result_id, v_status, v_event_code, v_prev_pub_at
    FROM public.event_results er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.event_id = p_event_id
    FOR UPDATE;

    IF v_result_id IS NULL THEN
        RAISE EXCEPTION 'Result not found: No result exists for event %.', p_event_id;
    END IF;

    IF v_status != 'PUBLISHED' THEN
        RAISE EXCEPTION 'This result is not currently published.';
    END IF;

    -- Deactivate all active ledger points
    WITH deactivated AS (
        UPDATE public.point_ledger
        SET is_active = FALSE
        WHERE result_entry_id IN (
            SELECT id FROM public.result_entries WHERE event_result_id = v_result_id
        ) AND is_active = TRUE
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deactivated_count FROM deactivated;

    -- Revert status to DRAFT
    UPDATE public.event_results
    SET status = 'DRAFT',
        published_by = NULL,
        published_at = NULL,
        updated_at = now()
    WHERE id = v_result_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        model_name,
        object_id,
        object_repr,
        changes
    ) VALUES (
        v_caller_id,
        'RESULT_UNPUBLISHED',
        'EventResult',
        v_result_id::text,
        'Result for ' || v_event_code,
        jsonb_build_object(
            'status', jsonb_build_object('old', 'PUBLISHED', 'new', 'DRAFT'),
            'reason', COALESCE(p_reason, 'Administrative unpublish request'),
            'deactivated_ledger_count', v_deactivated_count,
            'prev_published_at', v_prev_pub_at
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'event_result_id', v_result_id,
        'status', 'DRAFT',
        'deactivated_ledger_count', v_deactivated_count
    );
END;
$$;

-- 5. RPC Function: Correct Published Result (Atomic Update with Audit Diffs)
CREATE OR REPLACE FUNCTION public.correct_published_result(
    p_event_id UUID,
    p_entries JSONB,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_publisher BOOLEAN;
    v_result_id UUID;
    v_status TEXT;
    v_event_code TEXT;
    v_old_scores JSONB;
    v_new_scores JSONB;
    v_draft_res JSONB;
    v_notes TEXT;
    v_edition_id UUID;
    v_event_type TEXT;
    v_contrib_indiv BOOLEAN;
    v_entry RECORD;
    v_rp RECORD;
    v_ledger_count INTEGER := 0;
BEGIN
    v_caller_id := auth.uid();
    v_is_publisher := public.is_publisher();
    IF NOT v_is_publisher AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN and PUBLISHER roles can correct published results.';
    END IF;

    IF trim(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'Validation Error: A reason for score correction is mandatory for audit compliance.';
    END IF;

    -- Lock EventResult
    SELECT er.id, er.status, er.notes, e.code, e.edition_id, e.event_type, e.contributes_to_individual
    INTO v_result_id, v_status, v_notes, v_event_code, v_edition_id, v_event_type, v_contrib_indiv
    FROM public.event_results er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.event_id = p_event_id
    FOR UPDATE;

    IF v_result_id IS NULL THEN
        RAISE EXCEPTION 'Result not found: No result exists for event %.', p_event_id;
    END IF;

    IF v_status != 'PUBLISHED' THEN
        RAISE EXCEPTION 'This result is not published. Only published results can be corrected.';
    END IF;

    -- Capture old scores for audit trail
    SELECT COALESCE(
        jsonb_object_agg(
            chest_number,
            jsonb_build_object(
                'participant', participant_name,
                'position', position,
                'grade', grade,
                'total_points', total_points::text
            )
        ),
        '{}'::jsonb
    ) INTO v_old_scores
    FROM public.result_entries
    WHERE event_result_id = v_result_id;

    -- Temporarily revert status to DRAFT internally so save_result_draft can modify entries
    UPDATE public.event_results SET status = 'DRAFT' WHERE id = v_result_id;

    -- Save new entries with secure recalculation
    v_draft_res := public.save_result_draft(p_event_id, p_entries, v_notes);

    -- Deactivate old ledger entries and re-post active ledger points
    UPDATE public.point_ledger
    SET is_active = FALSE
    WHERE result_entry_id IN (
        SELECT id FROM public.result_entries WHERE event_result_id = v_result_id
    );

    FOR v_entry IN 
        SELECT id, church_id, participant_id, total_points 
        FROM public.result_entries 
        WHERE event_result_id = v_result_id
    LOOP
        IF v_entry.total_points > 0.00 THEN
            -- Church points
            INSERT INTO public.point_ledger (
                edition_id,
                result_entry_id,
                event_id,
                church_id,
                participant_id,
                target,
                points,
                is_active
            ) VALUES (
                v_edition_id,
                v_entry.id,
                p_event_id,
                v_entry.church_id,
                NULL,
                'CHURCH',
                v_entry.total_points,
                TRUE
            );
            v_ledger_count := v_ledger_count + 1;

            -- Individual points
            IF v_event_type = 'INDIVIDUAL' THEN
                IF v_contrib_indiv AND v_entry.participant_id IS NOT NULL THEN
                    INSERT INTO public.point_ledger (
                        edition_id,
                        result_entry_id,
                        event_id,
                        church_id,
                        participant_id,
                        target,
                        points,
                        is_active
                    ) VALUES (
                        v_edition_id,
                        v_entry.id,
                        p_event_id,
                        v_entry.church_id,
                        v_entry.participant_id,
                        'INDIVIDUAL',
                        v_entry.total_points,
                        TRUE
                    );
                    v_ledger_count := v_ledger_count + 1;
                END IF;
            ELSE
                FOR v_rp IN 
                    SELECT participant_id, points_allocated 
                    FROM public.result_participants 
                    WHERE result_entry_id = v_entry.id AND points_allocated > 0.00
                LOOP
                    INSERT INTO public.point_ledger (
                        edition_id,
                        result_entry_id,
                        event_id,
                        church_id,
                        participant_id,
                        target,
                        points,
                        is_active
                    ) VALUES (
                        v_edition_id,
                        v_entry.id,
                        p_event_id,
                        v_entry.church_id,
                        v_rp.participant_id,
                        'INDIVIDUAL',
                        v_rp.points_allocated,
                        TRUE
                    );
                    v_ledger_count := v_ledger_count + 1;
                END LOOP;
            END IF;
        END IF;
    END LOOP;

    -- Ensure result returns to and stays PUBLISHED
    UPDATE public.event_results
    SET status = 'PUBLISHED',
        updated_at = now()
    WHERE id = v_result_id;

    -- Capture new scores for audit trail
    SELECT COALESCE(
        jsonb_object_agg(
            chest_number,
            jsonb_build_object(
                'participant', participant_name,
                'position', position,
                'grade', grade,
                'total_points', total_points::text
            )
        ),
        '{}'::jsonb
    ) INTO v_new_scores
    FROM public.result_entries
    WHERE event_result_id = v_result_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        model_name,
        object_id,
        object_repr,
        changes
    ) VALUES (
        v_caller_id,
        'RESULT_CORRECTED',
        'EventResult',
        v_result_id::text,
        'Result for ' || v_event_code,
        jsonb_build_object(
            'reason', p_reason,
            'old_scores', v_old_scores,
            'new_scores', v_new_scores,
            'ledger_records_recalculated', v_ledger_count
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'event_result_id', v_result_id,
        'status', 'PUBLISHED',
        'ledger_records_recalculated', v_ledger_count
    );
END;
$$;

-- 6. RPC Function: Delete Result Draft
CREATE OR REPLACE FUNCTION public.delete_result_draft(
    p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_super BOOLEAN;
    v_result_id UUID;
    v_status TEXT;
    v_event_code TEXT;
BEGIN
    v_caller_id := auth.uid();
    v_is_super := public.is_super_admin();
    IF NOT v_is_super AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN can delete result drafts.';
    END IF;

    SELECT er.id, er.status, e.code
    INTO v_result_id, v_status, v_event_code
    FROM public.event_results er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.event_id = p_event_id;

    IF v_result_id IS NULL THEN
        RAISE EXCEPTION 'Result not found for event %.', p_event_id;
    END IF;

    IF v_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Cannot delete a published result. Unpublish it first.';
    END IF;

    DELETE FROM public.event_results WHERE id = v_result_id;

    INSERT INTO public.audit_logs (
        user_id,
        action,
        model_name,
        object_id,
        object_repr,
        changes
    ) VALUES (
        v_caller_id,
        'RESULT_DRAFT_DELETED',
        'EventResult',
        v_result_id::text,
        'Result for ' || v_event_code,
        jsonb_build_object('event_id', p_event_id)
    );

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 7. Grant Permissions
GRANT EXECUTE ON FUNCTION public.save_result_draft(UUID, JSONB, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.publish_result(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.unpublish_result(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.correct_published_result(UUID, JSONB, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_result_draft(UUID) TO authenticated, anon;
