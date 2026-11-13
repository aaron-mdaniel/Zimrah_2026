-- ==============================================================================
-- ZIMRAH 2026 – Migration 010: Database Triggers & Kernel Calculations
-- ==============================================================================

-- 1. Server-Side Score Invariant Trigger Function (ADR-006)
-- Automatically calculates Total Points = Grade Points + Position Points
-- Browser or client input for total_points is overwritten to prevent tampering
CREATE OR REPLACE FUNCTION public.trg_fn_calculate_result_entry_total_points()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_points := COALESCE(NEW.grade_points, 0.00) + COALESCE(NEW.position_points, 0.00);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_total_points ON public.result_entries;
CREATE TRIGGER trg_calculate_total_points
    BEFORE INSERT OR UPDATE OF grade_points, position_points
    ON public.result_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_calculate_result_entry_total_points();

-- 2. Attach updated_at triggers to all mutable tables
DROP TRIGGER IF EXISTS trg_editions_updated_at ON public.editions;
CREATE TRIGGER trg_editions_updated_at
    BEFORE UPDATE ON public.editions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_churches_updated_at ON public.churches;
CREATE TRIGGER trg_churches_updated_at
    BEFORE UPDATE ON public.churches
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_participants_updated_at ON public.participants;
CREATE TRIGGER trg_participants_updated_at
    BEFORE UPDATE ON public.participants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_registrations_updated_at ON public.registrations;
CREATE TRIGGER trg_registrations_updated_at
    BEFORE UPDATE ON public.registrations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_event_results_updated_at ON public.event_results;
CREATE TRIGGER trg_event_results_updated_at
    BEFORE UPDATE ON public.event_results
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_result_entries_updated_at ON public.result_entries;
CREATE TRIGGER trg_result_entries_updated_at
    BEFORE UPDATE ON public.result_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
