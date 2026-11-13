-- ==============================================================================
-- ZIMRAH 2026 – Migration 011: Performance Indexes & Query Optimization
-- ==============================================================================

-- 1. Editions
CREATE INDEX IF NOT EXISTS idx_editions_year ON public.editions(year);
CREATE INDEX IF NOT EXISTS idx_editions_is_active ON public.editions(is_active);

-- 2. Churches
CREATE INDEX IF NOT EXISTS idx_churches_code ON public.churches(code);
CREATE INDEX IF NOT EXISTS idx_churches_name ON public.churches(name);
CREATE INDEX IF NOT EXISTS idx_churches_is_active ON public.churches(is_active);

-- 3. Participants
CREATE INDEX IF NOT EXISTS idx_participants_edition_chest ON public.participants(edition_id, chest_number);
CREATE INDEX IF NOT EXISTS idx_participants_edition_church ON public.participants(edition_id, church_id);
CREATE INDEX IF NOT EXISTS idx_participants_name ON public.participants(name);
CREATE INDEX IF NOT EXISTS idx_participants_chest ON public.participants(chest_number);
CREATE INDEX IF NOT EXISTS idx_participants_age_gender ON public.participants(age_category, gender);

-- 4. Event Categories, Divisions & Sections
CREATE INDEX IF NOT EXISTS idx_event_categories_edition ON public.event_categories(edition_id);
CREATE INDEX IF NOT EXISTS idx_event_divisions_edition ON public.event_divisions(edition_id, division_number);
CREATE INDEX IF NOT EXISTS idx_event_sections_edition ON public.event_sections(edition_id, code);

-- 5. Events
CREATE INDEX IF NOT EXISTS idx_events_edition_code ON public.events(edition_id, code);
CREATE INDEX IF NOT EXISTS idx_events_edition_category ON public.events(edition_id, category_id);
CREATE INDEX IF NOT EXISTS idx_events_edition_division ON public.events(edition_id, division_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);

-- 6. Registrations
CREATE INDEX IF NOT EXISTS idx_registrations_edition_event ON public.registrations(edition_id, event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_edition_church ON public.registrations(edition_id, church_id);
CREATE INDEX IF NOT EXISTS idx_registrations_chest ON public.registrations(chest_number);
CREATE INDEX IF NOT EXISTS idx_registrations_participant ON public.registrations(participant_id);
CREATE INDEX IF NOT EXISTS idx_group_members_participant ON public.group_registration_members(participant_id);

-- 7. Event Results
CREATE INDEX IF NOT EXISTS idx_event_results_status ON public.event_results(status);
CREATE INDEX IF NOT EXISTS idx_event_results_updated ON public.event_results(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_results_published_at ON public.event_results(published_at DESC);

-- 8. Result Entries
CREATE INDEX IF NOT EXISTS idx_result_entries_event_pos ON public.result_entries(event_result_id, position);
CREATE INDEX IF NOT EXISTS idx_result_entries_church ON public.result_entries(church_id);
CREATE INDEX IF NOT EXISTS idx_result_entries_chest ON public.result_entries(chest_number);
CREATE INDEX IF NOT EXISTS idx_result_entries_position ON public.result_entries(position);
CREATE INDEX IF NOT EXISTS idx_result_entries_grade ON public.result_entries(grade);
CREATE INDEX IF NOT EXISTS idx_result_entries_total_points ON public.result_entries(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_result_participants_participant ON public.result_participants(participant_id);

-- 9. Point Ledger
CREATE INDEX IF NOT EXISTS idx_point_ledger_edition_target_active ON public.point_ledger(edition_id, target, is_active);
CREATE INDEX IF NOT EXISTS idx_point_ledger_church_active ON public.point_ledger(church_id, is_active);
CREATE INDEX IF NOT EXISTS idx_point_ledger_participant_active ON public.point_ledger(participant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_point_ledger_event_active ON public.point_ledger(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_point_ledger_result_entry ON public.point_ledger(result_entry_id);

-- 10. Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_model_object ON public.audit_logs(model_name, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
