-- ==============================================================================
-- ZIMRAH 2026 – Migration 013: Master Data Enhancements & Bulk Import RPC
-- ==============================================================================

-- 1. Add is_active column to public.events if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'events' 
          AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.events ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
        CREATE INDEX IF NOT EXISTS idx_events_edition_active ON public.events(edition_id, is_active);
    END IF;
END $$;

-- 2. Safe Server-Side Transactional Bulk Participant Import Function (RPC)
-- Validates church code, preserves leading zeros for chest numbers, detects collisions,
-- supports staged dry-run preview, and logs to audit trail.
CREATE OR REPLACE FUNCTION public.bulk_import_participants(
    p_edition_id UUID,
    p_records JSONB,
    p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_record JSONB;
    v_chest_no TEXT;
    v_name TEXT;
    v_name_mal TEXT;
    v_gender TEXT;
    v_church_code TEXT;
    v_church_id UUID;
    v_age_cat TEXT;
    v_phone TEXT;
    v_row_idx INTEGER := 0;
    v_valid_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
    v_batch_chests TEXT[] := ARRAY[]::TEXT[];
    v_to_insert JSONB := '[]'::jsonb;
    v_inserted_count INTEGER := 0;
    v_is_admin BOOLEAN;
    v_caller_id UUID;
BEGIN
    -- Check caller authorization: RESULT_ADMIN or SUPER_ADMIN
    v_caller_id := auth.uid();
    v_is_admin := public.is_admin();

    IF NOT v_is_admin AND current_user NOT IN ('postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Access Denied: Only RESULT_ADMIN or SUPER_ADMIN can bulk import participants.';
    END IF;

    -- Verify edition exists
    IF NOT EXISTS (SELECT 1 FROM public.editions WHERE id = p_edition_id) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Festival edition not found.',
            'imported_count', 0,
            'errors', jsonb_build_array('Specified edition does not exist.')
        );
    END IF;

    -- Validate and stage each record
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_row_idx := v_row_idx + 1;
        
        -- Clean fields (strictly preserve chest_no leading zeroes as text)
        v_chest_no := trim(COALESCE(v_record->>'chest_number', v_record->>'chest_no', v_record->>'chest', ''));
        v_name := trim(COALESCE(v_record->>'name', v_record->>'full_name', ''));
        v_name_mal := trim(COALESCE(v_record->>'name_malayalam', ''));
        v_gender := upper(trim(COALESCE(v_record->>'gender', 'M')));
        v_church_code := upper(trim(COALESCE(v_record->>'church_code', v_record->>'church', '')));
        v_age_cat := upper(trim(COALESCE(v_record->>'age_category', v_record->>'category', 'OPEN')));
        v_phone := trim(COALESCE(v_record->>'phone', ''));

        -- Standardize gender
        IF v_gender NOT IN ('M', 'F') THEN
            v_gender := 'M';
        END IF;

        -- Standardize age category
        IF v_age_cat NOT IN ('JUNIOR', 'SENIOR', 'OPEN') THEN
            v_age_cat := 'OPEN';
        END IF;

        -- 1. Check required fields
        IF v_chest_no = '' OR v_name = '' THEN
            v_errors := v_errors || jsonb_build_object(
                'row', v_row_idx,
                'chest_number', v_chest_no,
                'error', 'Missing required chest_number or name.'
            );
            v_error_count := v_error_count + 1;
            CONTINUE;
        END IF;

        -- 2. Check internal batch duplicate
        IF v_chest_no = ANY(v_batch_chests) THEN
            v_errors := v_errors || jsonb_build_object(
                'row', v_row_idx,
                'chest_number', v_chest_no,
                'error', format('Duplicate chest number "%s" found within this import batch.', v_chest_no)
            );
            v_error_count := v_error_count + 1;
            CONTINUE;
        END IF;

        -- 3. Check church code existence
        SELECT id INTO v_church_id
        FROM public.churches
        WHERE upper(code) = v_church_code
        LIMIT 1;

        IF v_church_id IS NULL THEN
            v_errors := v_errors || jsonb_build_object(
                'row', v_row_idx,
                'chest_number', v_chest_no,
                'church_code', v_church_code,
                'error', format('Church code "%s" does not exist in master data.', v_church_code)
            );
            v_error_count := v_error_count + 1;
            CONTINUE;
        END IF;

        -- 4. Check existing participant collision in this edition
        IF EXISTS (
            SELECT 1 FROM public.participants 
            WHERE edition_id = p_edition_id AND chest_number = v_chest_no
        ) THEN
            v_errors := v_errors || jsonb_build_object(
                'row', v_row_idx,
                'chest_number', v_chest_no,
                'error', format('Chest number "%s" is already assigned to an existing participant.', v_chest_no)
            );
            v_error_count := v_error_count + 1;
            CONTINUE;
        END IF;

        -- Valid record
        v_batch_chests := array_append(v_batch_chests, v_chest_no);
        v_valid_count := v_valid_count + 1;
        v_to_insert := v_to_insert || jsonb_build_object(
            'edition_id', p_edition_id,
            'chest_number', v_chest_no,
            'name', v_name,
            'name_malayalam', v_name_mal,
            'gender', v_gender,
            'church_id', v_church_id,
            'age_category', v_age_cat,
            'phone', v_phone
        );
    END LOOP;

    -- If dry run preview requested, return validation summary without persisting
    IF p_dry_run THEN
        RETURN jsonb_build_object(
            'success', (v_error_count = 0),
            'dry_run', TRUE,
            'total_rows', v_row_idx,
            'valid_count', v_valid_count,
            'error_count', v_error_count,
            'errors', v_errors,
            'staged_records', v_to_insert
        );
    END IF;

    -- If not dry run, insert valid records
    IF v_valid_count > 0 THEN
        INSERT INTO public.participants (
            edition_id,
            chest_number,
            name,
            name_malayalam,
            gender,
            church_id,
            age_category,
            phone
        )
        SELECT 
            (rec->>'edition_id')::UUID,
            rec->>'chest_number',
            rec->>'name',
            rec->>'name_malayalam',
            rec->>'gender',
            (rec->>'church_id')::UUID,
            rec->>'age_category',
            rec->>'phone'
        FROM jsonb_array_elements(v_to_insert) AS rec;

        GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

        -- Insert audit log entry
        INSERT INTO public.audit_logs (
            user_id,
            action,
            model_name,
            object_id,
            object_repr,
            changes
        ) VALUES (
            v_caller_id,
            'PARTICIPANTS_IMPORTED_CSV',
            'Edition',
            p_edition_id::text,
            'ZIMRAH 2026',
            jsonb_build_object(
                'imported_count', v_inserted_count,
                'error_count', v_error_count,
                'total_rows', v_row_idx
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'dry_run', FALSE,
        'total_rows', v_row_idx,
        'imported_count', v_inserted_count,
        'skipped_count', v_error_count,
        'errors', v_errors
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_import_participants(UUID, JSONB, BOOLEAN) TO authenticated, anon;
