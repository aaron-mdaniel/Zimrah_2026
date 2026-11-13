/**
 * ZIMRAH 2026 - Audit Service Contract
 * ADR-001: Preservation of Django Audit module
 * Records administrative actions and security-critical mutations
 */

import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types';

export interface LogActionParams {
  action:
    | 'LOGIN'
    | 'LOGOUT'
    | 'RESULT_SAVE'
    | 'RESULT_PUBLISH'
    | 'RESULT_UNPUBLISH'
    | 'RESULT_CORRECT'
    | 'CHURCH_MUTATION'
    | 'PARTICIPANT_MUTATION'
    | 'EVENT_MUTATION';
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
}

export interface AuditServiceInterface {
  log(params: LogActionParams): Promise<void>;
  getRecentLogs(limit?: number): Promise<AuditLog[]>;
}

export class SupabaseAuditService implements AuditServiceInterface {
  async log(params: LogActionParams): Promise<void> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action: params.action,
        model_name: params.resource_type,
        object_id: params.resource_id || '',
        object_repr: `${params.resource_type}: ${params.resource_id || 'System'}`,
        changes: params.details || {},
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.warn('Non-blocking: Failed to record audit log entry', err);
    }
  }

  async getRecentLogs(limit = 100): Promise<AuditLog[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as AuditLog[];
    } catch (err: unknown) {
      console.warn('Failed to retrieve audit logs', err);
      return [];
    }
  }
}

export const auditService = new SupabaseAuditService();
