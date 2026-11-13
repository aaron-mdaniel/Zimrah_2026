-- ==============================================================================
-- ZIMRAH 2026 – Migration 004: Participants Registry & Chest Number Handling
-- ==============================================================================

-- Participants Table
-- Mirrors apps.participants.models.Participant
-- ADR-005: Chest numbers must remain strings (VARCHAR/TEXT) to strictly preserve leading zeros (e.g. 001, 042)
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    chest_number VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    name_malayalam VARCHAR(150) NOT NULL DEFAULT '',
    gender VARCHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE RESTRICT,
    age_category VARCHAR(10) NOT NULL DEFAULT 'OPEN' 
        CHECK (age_category IN ('JUNIOR', 'SENIOR', 'OPEN')),
    phone VARCHAR(25) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_chest_number_per_edition UNIQUE (edition_id, chest_number)
);

COMMENT ON TABLE public.participants IS 'Contestants registered for the festival edition with leading-zero chest number preservation.';
COMMENT ON COLUMN public.participants.chest_number IS 'Preserves leading zeros (e.g. 001, 042) for stage badge printing and lookup.';
