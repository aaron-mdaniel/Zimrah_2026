-- ==============================================================================
-- ZIMRAH 2026 – Migration 008: Championship Point Ledger
-- ==============================================================================

-- Point Ledger Table
-- Mirrors apps.championships.models.PointLedger
-- Records immutable or active point allocations originating from published results
CREATE TABLE IF NOT EXISTS public.point_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
    result_entry_id UUID NOT NULL REFERENCES public.result_entries(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE RESTRICT,
    participant_id UUID REFERENCES public.participants(id) ON DELETE RESTRICT,
    target VARCHAR(20) NOT NULL CHECK (target IN ('INDIVIDUAL', 'CHURCH')),
    points DECIMAL(6, 2) NOT NULL DEFAULT 0.00 CHECK (points >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

COMMENT ON TABLE public.point_ledger IS 'Authoritative ledger of championship points credited to churches or individual participants.';
COMMENT ON COLUMN public.point_ledger.points IS 'Points awarded, stored in DECIMAL(6,2) to eliminate rounding error.';
COMMENT ON COLUMN public.point_ledger.is_active IS 'True when event result is actively published; set to false on unpublish or score correction.';
