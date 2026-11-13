-- ==============================================================================
-- ZIMRAH 2026 – Migration 007: Event Results, Result Entries & Score Allocations
-- ==============================================================================

-- 1. Event Results Table
-- OneToOne link with Event, manages publication state machine (DRAFT -> VERIFIED -> PUBLISHED)
CREATE TABLE IF NOT EXISTS public.event_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' 
        CHECK (status IN ('DRAFT', 'VERIFIED', 'PUBLISHED')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    published_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

-- 2. Result Entries Table
-- Official awarded score line: Grade Points + Position Points = Total Points
-- ADR-006: Server-side authoritative score calculation invariant
CREATE TABLE IF NOT EXISTS public.result_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_result_id UUID NOT NULL REFERENCES public.event_results(id) ON DELETE CASCADE,
    position SMALLINT CHECK (position IN (1, 2, 3)),
    chest_number VARCHAR(20) NOT NULL,
    participant_name VARCHAR(150) NOT NULL,
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE RESTRICT,
    participant_id UUID REFERENCES public.participants(id) ON DELETE RESTRICT,
    grade VARCHAR(5) NOT NULL DEFAULT '' CHECK (grade IN ('', 'A', 'B', 'C')),
    grade_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (grade_points >= 0),
    position_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (position_points >= 0),
    total_points DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (total_points >= 0),
    remarks VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

-- 3. Result Participants Table
-- Group member result attribution for individual championship points credit (ADR-004)
CREATE TABLE IF NOT EXISTS public.result_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_entry_id UUID NOT NULL REFERENCES public.result_entries(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL DEFAULT '',
    points_allocated DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (points_allocated >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE,
    CONSTRAINT unique_result_participant UNIQUE (result_entry_id, participant_id)
);

COMMENT ON TABLE public.event_results IS 'Competition result sheet with publication state machine.';
COMMENT ON TABLE public.result_entries IS 'Individual or team placement score entries. Points stored with DECIMAL(5,2) precision.';
COMMENT ON TABLE public.result_participants IS 'Participating members of a group result with points allocated to their individual standings.';
