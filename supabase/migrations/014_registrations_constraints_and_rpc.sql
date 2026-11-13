-- ==============================================================================
-- ZIMRAH 2026 – Migration 014: Registration Integrity Constraints, Quotas & RPC
-- ==============================================================================

-- 1. Index to prevent duplicate participant registrations for the same individual event
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_event_participant 
    ON public.registrations(event_id, participant_id) 
    WHERE participant_id IS NOT NULL;

-- 2. Index to prevent duplicate chest numbers within the same event
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_event_chest 
    ON public.registrations(event_id, chest_number) 
    WHERE chest_number != '';

-- 3. Trigger Function: Prevent duplicate participant enrollment across teams in the same group event
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_duplicate_group_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_event_id UUID;
    v_event_code TEXT;
    v_existing_group TEXT;
BEGIN
    -- Get the event_id for this registration
    SELECT r.event_id, e.code INTO v_event_id, v_event_code
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = NEW.registration_id;

    -- Check if participant is already registered in another group for this same event
    SELECT r.group_name INTO v_existing_group
    FROM public.group_registration_members grm
    JOIN public.registrations r ON r.id = grm.registration_id
    WHERE r.event_id = v_event_id 
      AND grm.participant_id = NEW.participant_id
      AND r.id != NEW.registration_id
    LIMIT 1;

    IF v_existing_group IS NOT NULL THEN
        RAISE EXCEPTION 'Membership Collision: Participant is already enrolled in team "%" for event %.', 
            v_existing_group, v_event_code;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_group_membership ON public.group_registration_members;
CREATE TRIGGER trg_prevent_duplicate_group_membership
    BEFORE INSERT OR UPDATE ON public.group_registration_members
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_prevent_duplicate_group_membership();

-- 4. Trigger Function: Enforce Church Entry Quotas
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_church_entry_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_max_entries INTEGER;
    v_current_entries INTEGER;
    v_event_code TEXT;
    v_church_code TEXT;
BEGIN
    SELECT e.max_entries_per_church, e.code INTO v_max_entries, v_event_code
    FROM public.events e
    WHERE e.id = NEW.event_id;

    SELECT c.code INTO v_church_code
    FROM public.churches c
    WHERE c.id = NEW.church_id;

    -- Count existing entries for this church in this event (excluding current row if updating)
    SELECT COUNT(*) INTO v_current_entries
    FROM public.registrations r
    WHERE r.event_id = NEW.event_id 
      AND r.church_id = NEW.church_id
      AND (TG_OP = 'INSERT' OR r.id != NEW.id);

    IF v_current_entries >= v_max_entries THEN
        RAISE EXCEPTION 'Quota Exceeded: Church % already has % registered entries for event % (Maximum permitted: %).',
            v_church_code, v_current_entries, v_event_code, v_max_entries;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_church_entry_quota ON public.registrations;
CREATE TRIGGER trg_enforce_church_entry_quota
    BEFORE INSERT ON public.registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_enforce_church_entry_quota();

-- 5. RPC Function: Atomic Group Registration with Member Rosters
CREATE OR REPLACE FUNCTION public.create_group_registration(
    p_edition_id UUID,
    p_event_id UUID,
    p_church_id UUID,
    p_group_name TEXT,
    p_chest_number TEXT,
    p_member_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN;
    v_event_type TEXT;
    v_min_p INTEGER;
    v_max_p INTEGER;
    v_member_count INTEGER;
    v_invalid_count INTEGER;
    v_reg_id UUID;
    v_m_id UUID;
BEGIN
    -- Check permissions
    v_caller_id := auth.uid();
    v_is_admin := public.is_admin();
    IF NOT v_is_admin AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can register group teams.';
    END IF;

    -- Check event rules
    SELECT event_type, min_participants, max_participants
    INTO v_event_type, v_min_p, v_max_p
    FROM public.events
    WHERE id = p_event_id;

    IF v_event_type != 'GROUP' THEN
        RAISE EXCEPTION 'Event Error: Competition is an individual event, not a group event.';
    END IF;

    v_member_count := coalesce(array_length(p_member_ids, 1), 0);
    IF v_member_count < v_min_p THEN
        RAISE EXCEPTION 'Team size under minimum: At least % members required (provided: %).', v_min_p, v_member_count;
    END IF;

    IF v_member_count > v_max_p THEN
        RAISE EXCEPTION 'Team size exceeds maximum: At most % members allowed (provided: %).', v_max_p, v_member_count;
    END IF;

    -- Verify all members belong to the specified church
    SELECT COUNT(*) INTO v_invalid_count
    FROM public.participants
    WHERE id = ANY(p_member_ids) AND church_id != p_church_id;

    IF v_invalid_count > 0 THEN
        RAISE EXCEPTION 'Church Affiliation Error: % participant(s) do not belong to the selected church.', v_invalid_count;
    END IF;

    -- Insert registration (Trigger will automatically enforce church quota and unique chest number)
    INSERT INTO public.registrations (
        edition_id,
        event_id,
        church_id,
        group_name,
        chest_number
    ) VALUES (
        p_edition_id,
        p_event_id,
        p_church_id,
        trim(p_group_name),
        trim(p_chest_number)
    ) RETURNING id INTO v_reg_id;

    -- Insert roster members (Trigger will automatically prevent cross-group duplicates)
    FOREACH v_m_id IN ARRAY p_member_ids
    LOOP
        INSERT INTO public.group_registration_members (
            registration_id,
            participant_id
        ) VALUES (
            v_reg_id,
            v_m_id
        );
    END LOOP;

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
        'GROUP_REGISTRATION_CREATED',
        'Registration',
        v_reg_id::text,
        p_group_name,
        jsonb_build_object(
            'group_name', p_group_name,
            'chest_number', p_chest_number,
            'member_count', v_member_count,
            'event_id', p_event_id
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'registration_id', v_reg_id,
        'member_count', v_member_count
    );
END;
$$;

-- 6. RPC Function: Individual Registration
CREATE OR REPLACE FUNCTION public.create_individual_registration(
    p_edition_id UUID,
    p_event_id UUID,
    p_church_id UUID,
    p_participant_id UUID,
    p_chest_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN;
    v_event_type TEXT;
    v_part_church_id UUID;
    v_chest TEXT;
    v_reg_id UUID;
    v_part_name TEXT;
BEGIN
    v_caller_id := auth.uid();
    v_is_admin := public.is_admin();
    IF NOT v_is_admin AND (v_caller_id IS NOT NULL OR nullif(current_setting('role', true), 'none') IN ('anon', 'authenticated')) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can register contestants.';
    END IF;

    -- Check event type
    SELECT event_type INTO v_event_type
    FROM public.events
    WHERE id = p_event_id;

    IF v_event_type != 'INDIVIDUAL' THEN
        RAISE EXCEPTION 'Event Error: Competition is a group event, not an individual event.';
    END IF;

    -- Verify church affiliation
    SELECT church_id, chest_number, name
    INTO v_part_church_id, v_chest, v_part_name
    FROM public.participants
    WHERE id = p_participant_id;

    IF v_part_church_id IS NULL OR v_part_church_id != p_church_id THEN
        RAISE EXCEPTION 'Church Affiliation Mismatch: Selected contestant is not registered under this church.';
    END IF;

    -- Default chest number to participant's chest number if not provided
    IF trim(coalesce(p_chest_number, '')) != '' THEN
        v_chest := trim(p_chest_number);
    END IF;

    -- Insert registration (Trigger checks quota and unique constraint checks duplicate participant)
    INSERT INTO public.registrations (
        edition_id,
        event_id,
        church_id,
        participant_id,
        chest_number
    ) VALUES (
        p_edition_id,
        p_event_id,
        p_church_id,
        p_participant_id,
        v_chest
    ) RETURNING id INTO v_reg_id;

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
        'REGISTRATION_CREATED',
        'Registration',
        v_reg_id::text,
        v_part_name,
        jsonb_build_object(
            'participant_name', v_part_name,
            'chest_number', v_chest,
            'event_id', p_event_id,
            'church_id', p_church_id
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'registration_id', v_reg_id,
        'chest_number', v_chest
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_registration(UUID, UUID, UUID, TEXT, TEXT, UUID[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_individual_registration(UUID, UUID, UUID, UUID, TEXT) TO authenticated, anon;
