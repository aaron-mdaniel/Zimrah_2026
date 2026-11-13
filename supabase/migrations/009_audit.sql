-- ==============================================================================
-- ZIMRAH 2026 – Migration 009: Audit Logs & Activity Trail
-- ==============================================================================

-- Audit Logs Table
-- Mirrors apps.audit.models.AuditLog
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    object_id VARCHAR(50) NOT NULL DEFAULT '',
    object_repr VARCHAR(200) NOT NULL DEFAULT '',
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_id BIGINT UNIQUE
);

COMMENT ON TABLE public.audit_logs IS 'Immutable activity log capturing administrative actions, scoring changes, and state transitions.';
COMMENT ON COLUMN public.audit_logs.changes IS 'JSONB payload capturing before and after state diff.';
