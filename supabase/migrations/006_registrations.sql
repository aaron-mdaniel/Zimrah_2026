-- ==============================================================================
-- ZIMRAH 2026 – Migration 006: Event Registrations & Group Team Rosters
-- ==============================================================================

-- 1. Registrations Table
-- Mirrors apps.registrations.models.Registration
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE RESTRICT,
    participant_id UUID REFERENCES public.participants(id) ON DELETE RESTRICT,
    group_name VARCHAR(150) NOT NULL DEFAULT '',
    chest_number VARCHAR(20) NOT NULL DEFAULT '',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

-- 2. Group Registration Members Table
-- Mirrors apps.registrations.models.GroupRegistrationMember
CREATE TABLE IF NOT EXISTS public.group_registration_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_registration_member UNIQUE (registration_id, participant_id)
);

COMMENT ON TABLE public.registrations IS 'Event enrollments for individual contestants or parish group teams.';
COMMENT ON TABLE public.group_registration_members IS 'Individual contestants enrolled as active members of a church team registration.';
