-- ==============================================================================
-- ZIMRAH 2026 – Migration 005: Event Catalog, Categories, Divisions & Sections
-- ==============================================================================

-- 1. Event Categories Table (Literary Events, Stage Events)
CREATE TABLE IF NOT EXISTS public.event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_malayalam VARCHAR(150) NOT NULL DEFAULT '',
    date DATE,
    venue VARCHAR(200) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_category_per_edition UNIQUE (edition_id, name)
);

-- 2. Event Divisions Table (1: Music, 2: Fine Arts, 3: Theater, 4: Writing & Elocution)
CREATE TABLE IF NOT EXISTS public.event_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    division_number SMALLINT NOT NULL CHECK (division_number > 0),
    name VARCHAR(100) NOT NULL,
    name_malayalam VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_division_per_edition UNIQUE (edition_id, division_number)
);

-- 3. Event Sections Table (JB, JG, SB, SG, JUNIOR, SENIOR, OPEN)
CREATE TABLE IF NOT EXISTS public.event_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_malayalam VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_section_per_edition UNIQUE (edition_id, code)
);

-- 4. Competitions / Events Table (34 Official Competitions)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    name_malayalam VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL REFERENCES public.event_categories(id) ON DELETE RESTRICT,
    division_id UUID REFERENCES public.event_divisions(id) ON DELETE RESTRICT,
    section_id UUID REFERENCES public.event_sections(id) ON DELETE RESTRICT,
    event_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL' 
        CHECK (event_type IN ('INDIVIDUAL', 'GROUP')),
    duration_minutes INTEGER,
    duration_display VARCHAR(50) NOT NULL DEFAULT '',
    min_participants INTEGER NOT NULL DEFAULT 1 CHECK (min_participants >= 1),
    max_participants INTEGER NOT NULL DEFAULT 1 CHECK (max_participants >= 1),
    max_entries_per_church INTEGER NOT NULL DEFAULT 1 CHECK (max_entries_per_church >= 1),
    contributes_to_individual BOOLEAN NOT NULL DEFAULT TRUE,
    contributes_to_church BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_event_code_per_edition UNIQUE (edition_id, code),
    CONSTRAINT check_participant_limits CHECK (max_participants >= min_participants)
);

COMMENT ON TABLE public.events IS 'Official 34 Kalolsavam competitions across 4 divisions with individual/group rules.';
COMMENT ON COLUMN public.events.code IS 'Standard competition code (e.g. EV01, EV15, EV34).';
