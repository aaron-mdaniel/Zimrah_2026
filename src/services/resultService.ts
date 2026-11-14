/**
 * ZIMRAH 2026 – Result Management Service
 * ADR-001 & ADR-006: Preservation of Django ResultService logic
 * Authoritative server-side scoring, atomic Point Ledger integration,
 * publication state machine, and audit trail generation.
 */

import { supabase } from '@/lib/supabase';
import {
  EventResult,
  ResultEntry,
  CompetitionEvent,
  Church,
  Participant,
  GradeType,
  PositionType,
} from '@/types';
import { eventService } from './eventService';
import { cacheService } from './cacheService';

export interface ResultEntryPayload {
  id?: string | number;
  chest_number: string;
  participant_name: string;
  church_id: string | number;
  participant_id?: string | number | null;
  position: PositionType;
  grade: GradeType;
  grade_points: string | number;
  position_points: string | number;
  total_points?: string | number;
  remarks?: string;
  group_members?: {
    participant_id: string | number;
    role?: string;
    points_allocated?: string | number;
  }[];
}

export interface EventResultStatusItem extends CompetitionEvent {
  result_id?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PENDING';
  entries_count: number;
  notes?: string;
  published_at?: string;
  published_by?: string;
  updated_at?: string;
}

export interface EventResultDetailResponse {
  event: CompetitionEvent;
  result: EventResult | null;
  entries: ResultEntry[];
  registrations: {
    id: string | number;
    chest_number: string;
    group_name?: string;
    church_id: string | number;
    participant_id?: string | number;
    church?: Church;
    participant?: Participant;
  }[];
}

export interface AuditHistoryEntry {
  id: string;
  action: string;
  model_name: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, unknown>;
  timestamp: string;
  user_email?: string;
}

const LOCAL_STORAGE_RESULTS_KEY = 'zimrah_master_results';

// Initial local seed results for fallback
const SEED_RESULTS: EventResult[] = [
  {
    id: 'res_ev01',
    event_id: 'ev01',
    status: 'PUBLISHED',
    published_at: '2026-11-14T10:00:00Z',
    notes: 'Official verified results',
    entries: [
      {
        id: 'entry_1',
        event_result_id: 'res_ev01',
        position: 1,
        chest_number: '001',
        participant_name: 'Aaron Samuel',
        church_id: 'c1',
        participant_id: 'p1',
        grade: 'A',
        grade_points: 5.0,
        position_points: 5.0,
        total_points: 10.0,
        remarks: '1st Prize with A Grade',
        church: {
          id: 'c1',
          code: 'CH01',
          name: 'St. Mathias CSI Church, Munroethuruth',
          district: 'Adoor Clergy District',
          is_active: true,
        },
      },
      {
        id: 'entry_2',
        event_result_id: 'res_ev01',
        position: 2,
        chest_number: '010',
        participant_name: 'Mathew Thomas',
        church_id: 'c2',
        participant_id: 'p10',
        grade: 'A',
        grade_points: 5.0,
        position_points: 3.0,
        total_points: 8.0,
        remarks: '2nd Prize with A Grade',
        church: {
          id: 'c2',
          code: 'CH02',
          name: 'Holy Trinity CSI Church, Adoor',
          district: 'Adoor Clergy District',
          is_active: true,
        },
      },
    ],
  },
];

function getLocalResults(): EventResult[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RESULTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage results parse failed:', err);
  }
  return [...SEED_RESULTS];
}

export const resultService = {
  /**
   * Fetches the overview of all 34 events with their current scoring publication status.
   */
  async getEventsResultStatus(params: {
    search?: string;
    status?: string;
    categoryId?: string;
    divisionId?: string;
  } = {}): Promise<{ events: EventResultStatusItem[]; total: number }> {
    const { search = '', status = '', categoryId = '', divisionId = '' } = params;

    try {
      // 1. Fetch events
      const eventsRes = await eventService.getEvents({
        search,
        categoryId,
        divisionId,
        page: 1,
        pageSize: 100,
      });

      // 2. Fetch event_results from Supabase
      const { data: results, error } = await supabase
        .from('event_results')
        .select(`
          id,
          event_id,
          status,
          notes,
          published_at,
          published_by,
          updated_at,
          entries:result_entries(id)
        `);

      if (!error && results) {
        const resultMap = new Map<string, typeof results[0]>();
        results.forEach((r) => {
          resultMap.set(String(r.event_id), r);
        });

        const statusItems: EventResultStatusItem[] = eventsRes.events.map((ev) => {
          const res = resultMap.get(String(ev.id));
          const evStatus = (res?.status || 'PENDING') as 'DRAFT' | 'PUBLISHED' | 'PENDING';
          const entriesCount = res?.entries ? res.entries.length : 0;

          return {
            ...ev,
            result_id: res?.id,
            status: evStatus,
            entries_count: entriesCount,
            notes: res?.notes,
            published_at: res?.published_at,
            published_by: res?.published_by,
            updated_at: res?.updated_at,
          };
        });

        const filtered = status
          ? statusItems.filter((item) => item.status === status)
          : statusItems;

        return {
          events: filtered,
          total: filtered.length,
        };
      }
    } catch (err) {
      console.warn('Supabase getEventsResultStatus error, falling back:', err);
    }

    // Fallback
    const local = getLocalResults();
    const eventsRes = await eventService.getEvents({
      search,
      categoryId,
      divisionId,
      page: 1,
      pageSize: 100,
    });

    const resultMap = new Map<string, EventResult>();
    local.forEach((r) => resultMap.set(String(r.event_id), r));

    const statusItems: EventResultStatusItem[] = eventsRes.events.map((ev) => {
      const res = resultMap.get(String(ev.id));
      const evStatus = (res?.status || 'PENDING') as 'DRAFT' | 'PUBLISHED' | 'PENDING';
      const entriesCount = res?.entries ? res.entries.length : 0;

      return {
        ...ev,
        result_id: res ? String(res.id) : undefined,
        status: evStatus,
        entries_count: entriesCount,
        notes: res?.notes,
        published_at: res?.published_at,
        published_by: res?.published_by,
        updated_at: res?.updated_at,
      };
    });

    const filtered = status
      ? statusItems.filter((item) => item.status === status)
      : statusItems;

    return {
      events: filtered,
      total: filtered.length,
    };
  },

  /**
   * Fetches full event scorecard details including entries, churches, participants, and registered contestants for 1-click loading.
   */
  async getEventResultDetail(eventId: string | number): Promise<EventResultDetailResponse> {
    const event = await eventService.getEventById(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    let result: EventResult | null = null;
    let entries: ResultEntry[] = [];
    let registrations: EventResultDetailResponse['registrations'] = [];

    try {
      // 1. Fetch current result
      const { data: resData, error: resError } = await supabase
        .from('event_results')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (!resError && resData) {
        result = resData as EventResult;

        // Fetch result entries with joined church and participants
        const { data: entryData, error: entryError } = await supabase
          .from('result_entries')
          .select(`
            *,
            church:churches(id, code, name, district),
            participant:participants(id, chest_number, name, name_malayalam, gender, age_category),
            participants:result_participants(
              id,
              role,
              points_allocated,
              participant:participants(id, chest_number, name, name_malayalam)
            )
          `)
          .eq('event_result_id', result.id)
          .order('position', { ascending: true, nullsFirst: false })
          .order('total_points', { ascending: false });

        if (!entryError && entryData) {
          entries = entryData as ResultEntry[];
        }
      }

      // 2. Fetch event registrations for convenient 1-click loading
      const { data: regData, error: regError } = await supabase
        .from('registrations')
        .select(`
          id,
          chest_number,
          group_name,
          church_id,
          participant_id,
          church:churches(id, code, name, district),
          participant:participants(id, chest_number, name, name_malayalam, gender, age_category)
        `)
        .eq('event_id', eventId)
        .order('chest_number', { ascending: true });

      if (!regError && regData) {
        registrations = regData as unknown as EventResultDetailResponse['registrations'];
      }
    } catch (err) {
      console.warn('Supabase getEventResultDetail error, falling back:', err);
    }

    // Local fallback if empty
    if (!result) {
      const local = getLocalResults();
      const matched = local.find((r) => String(r.event_id) === String(eventId));
      if (matched) {
        result = matched;
        entries = matched.entries || [];
      }
    }

    return {
      event,
      result,
      entries,
      registrations,
    };
  },

  /**
   * Saves or updates event results in DRAFT state via atomic PostgreSQL RPC.
   * Total points are authoritatively recalculated on the server.
   */
  async saveDraft(
    eventId: string | number,
    entries: ResultEntryPayload[],
    notes: string = ''
  ): Promise<{ success: boolean; eventResultId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('save_result_draft', {
        p_event_id: eventId,
        p_entries: entries,
        p_notes: notes,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      await cacheService.invalidateAll(undefined, 'RESULT_DRAFT_SAVED').catch(() => {});
      return {
        success: true,
        eventResultId: data?.event_result_id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft results';
      return { success: false, error: msg };
    }
  },

  /**
   * Publishes verified result and credits active Championship Point Ledger atomically.
   */
  async publishResult(
    eventId: string | number
  ): Promise<{ success: boolean; publishedAt?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('publish_result', {
        p_event_id: eventId,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      // Invalidate distributed Redis cache
      await cacheService.invalidateAll(undefined, 'RESULT_PUBLISHED').catch(() => {});
      return {
        success: true,
        publishedAt: data?.published_at,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish result';
      return { success: false, error: msg };
    }
  },

  /**
   * Unpublishes an event result, reverting to DRAFT and immediately deactivating Point Ledger records.
   */
  async unpublishResult(
    eventId: string | number,
    reason: string = ''
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('unpublish_result', {
        p_event_id: eventId,
        p_reason: reason,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      // Invalidate distributed Redis cache
      await cacheService.invalidateAll(undefined, 'RESULT_UNPUBLISHED').catch(() => {});
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unpublish result';
      return { success: false, error: msg };
    }
  },

  /**
   * Corrects an already published result with mandatory reason and before/after audit tracking.
   */
  async correctResult(
    eventId: string | number,
    entries: ResultEntryPayload[],
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!reason.trim()) {
      return { success: false, error: 'A reason for score correction is mandatory for audit compliance.' };
    }

    try {
      const { error } = await supabase.rpc('correct_published_result', {
        p_event_id: eventId,
        p_entries: entries,
        p_reason: reason,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      // Invalidate distributed Redis cache
      await cacheService.invalidateAll(undefined, 'RESULT_CORRECTED').catch(() => {});
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to apply score correction';
      return { success: false, error: msg };
    }
  },

  /**
   * Deletes a draft result (SUPER_ADMIN only). Cannot delete published results.
   */
  async deleteDraft(eventId: string | number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('delete_result_draft', {
        p_event_id: eventId,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      await cacheService.invalidateAll(undefined, 'RESULT_DRAFT_DELETED').catch(() => {});
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete draft result';
      return { success: false, error: msg };
    }
  },

  /**
   * Fetches audit history timeline for a specific event result.
   */
  async getResultAuditHistory(resultId: string | number): Promise<AuditHistoryEntry[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('model_name', 'EventResult')
        .eq('object_id', String(resultId))
        .order('timestamp', { ascending: false });

      if (!error && data) {
        return data as AuditHistoryEntry[];
      }
    } catch (err) {
      console.warn('Supabase getResultAuditHistory error:', err);
    }
    return [];
  },

  /**
   * Public REST-style method returning only verified published results.
   */
  async getPublishedResults(): Promise<EventResult[]> {
    try {
      const { data, error } = await supabase
        .from('event_results')
        .select(`
          *,
          event:events(*),
          entries:result_entries(
            *,
            church:churches(*),
            participant:participants(*)
          )
        `)
        .eq('status', 'PUBLISHED')
        .order('published_at', { ascending: false });

      if (!error && data) {
        return data as EventResult[];
      }
    } catch (err) {
      console.warn('Supabase getPublishedResults error:', err);
    }
    return getLocalResults().filter((r) => r.status === 'PUBLISHED');
  },
};
