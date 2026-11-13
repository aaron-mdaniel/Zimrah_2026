-- ==============================================================================
-- ZIMRAH 2026 – Migration 001: Initial Schema, Extensions & Root Edition Model
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Core automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Festival Editions Table
-- Root entity anchoring all competitions, participants, registrations, and points
CREATE TABLE IF NOT EXISTS public.editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL DEFAULT 'ZIMRAH 2026',
    theme VARCHAR(150) NOT NULL DEFAULT 'Song of Praise',
    organizer VARCHAR(200) NOT NULL DEFAULT 'CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement',
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

COMMENT ON TABLE public.editions IS 'Festival editions (e.g. ZIMRAH 2026) anchoring all categories, events, participants, and championship standings.';
COMMENT ON COLUMN public.editions.legacy_id IS 'Traceable reference to legacy Django model integer primary key.';
