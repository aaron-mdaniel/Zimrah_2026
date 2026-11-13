-- ==============================================================================
-- ZIMRAH 2026 – Migration 003: Parish Churches Registry
-- ==============================================================================

-- Churches Table
-- Mirrors apps.churches.models.Church
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    name_malayalam VARCHAR(200) NOT NULL DEFAULT '',
    district VARCHAR(100) NOT NULL DEFAULT 'Adoor Clergy District',
    vicar_name VARCHAR(120) NOT NULL DEFAULT '',
    youth_leader_name VARCHAR(120) NOT NULL DEFAULT '',
    contact_phone VARCHAR(25) NOT NULL DEFAULT '',
    contact_email VARCHAR(254) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

COMMENT ON TABLE public.churches IS 'Parish Churches / Congregations under CSI Madhya Kerala Diocese competing in ZIMRAH.';
COMMENT ON COLUMN public.churches.code IS 'Unique alphanumeric church identifier code (e.g. CH01, CH02).';
