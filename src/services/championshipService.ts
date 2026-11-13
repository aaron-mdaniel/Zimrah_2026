/**
 * ZIMRAH 2026 – Championship Service
 * ADR-001 & ADR-006: Preservation of Django ChampionshipService calculations
 * ADR-007: Generation-based distributed caching via Upstash Redis + CacheService
 * 5-level tie-breaking hierarchy, standard competition ranking (1, 2, 2, 4...),
 * Point Ledger aggregation, live summary, and event contribution breakdowns.
 */

import { supabase } from '@/lib/supabase';
import { cacheService, CacheService } from './cacheService';
import type { ChurchStanding, IndividualStanding, LiveSummary } from '@/types';

export interface ChurchEventBreakdownItem {
  ledger_id: string;
  event_id: string;
  event_code: string;
  event_name: string;
  event_name_malayalam?: string;
  event_type: string;
  participant_name: string;
  chest_number: string;
  position: number | null;
  grade: string;
  points: number;
  created_at: string;
}

export interface IndividualEventBreakdownItem {
  ledger_id: string;
  event_id: string;
  event_code: string;
  event_name: string;
  event_name_malayalam?: string;
  event_type: string;
  position: number | null;
  grade: string;
  role?: string;
  points: number;
  created_at: string;
}

export interface ChampionshipServiceInterface {
  getChurchStandings(editionId?: string, search?: string): Promise<ChurchStanding[]>;
  getIndividualStandings(
    category?: string,
    search?: string,
    onlyWithPoints?: boolean,
    editionId?: string
  ): Promise<IndividualStanding[]>;
  getLiveSummary(editionId?: string): Promise<LiveSummary>;
  getChurchBreakdown(churchId: string, editionId?: string): Promise<ChurchEventBreakdownItem[]>;
  getParticipantBreakdown(
    participantId: string,
    editionId?: string
  ): Promise<IndividualEventBreakdownItem[]>;
}

export class SupabaseChampionshipService implements ChampionshipServiceInterface {
  /**
   * Fetches church championship standings with standard competition ranking and 5-level tie-breaking.
   * Cached in Upstash Redis under generation key (TTL 300s).
   */
  async getChurchStandings(editionId?: string, search?: string): Promise<ChurchStanding[]> {
    const cacheId = `${editionId || 'default'}:${search || ''}`;
    try {
      const cached = await cacheService.get<ChurchStanding[]>('church_standings', cacheId, editionId);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Non-blocking cache lookup
    }

    try {
      const { data, error } = await supabase.rpc('get_church_standings', {
        p_edition_id: editionId || null,
        p_search: search ? search.trim() : null,
      });

      if (error) throw error;
      const standings = (data || []) as ChurchStanding[];

      // Populate Redis cache asynchronously
      cacheService
        .set('church_standings', cacheId, standings, CacheService.DEFAULT_TIMEOUT, editionId)
        .catch(() => {});

      return standings;
    } catch (err: unknown) {
      console.warn('Fallback: Error executing get_church_standings RPC', err);
      return [];
    }
  }

  /**
   * Fetches individual contestant championship standings (Kalathilakam / Kalaprathibha).
   * Supports Overall, Junior, and Senior categories.
   * Cached in Upstash Redis under generation key (TTL 300s).
   */
  async getIndividualStandings(
    category?: string,
    search?: string,
    onlyWithPoints: boolean = false,
    editionId?: string
  ): Promise<IndividualStanding[]> {
    const cacheId = `${editionId || 'default'}:${category || 'ALL'}:${search || ''}:${onlyWithPoints}`;
    try {
      const cached = await cacheService.get<IndividualStanding[]>('individual_standings', cacheId, editionId);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Non-blocking cache lookup
    }

    try {
      const { data, error } = await supabase.rpc('get_individual_standings', {
        p_edition_id: editionId || null,
        p_category: category && category !== 'ALL' ? category.trim() : null,
        p_search: search ? search.trim() : null,
        p_only_with_points: onlyWithPoints,
      });

      if (error) throw error;
      const standings = (data || []) as IndividualStanding[];

      // Populate Redis cache asynchronously
      cacheService
        .set('individual_standings', cacheId, standings, CacheService.DEFAULT_TIMEOUT, editionId)
        .catch(() => {});

      return standings;
    } catch (err: unknown) {
      console.warn('Fallback: Error executing get_individual_standings RPC', err);
      return [];
    }
  }

  /**
   * Fetches live statistics, top 3 churches, top 3 individuals, and latest published results.
   * Cached in Upstash Redis under generation key with 60s TTL.
   */
  async getLiveSummary(editionId?: string): Promise<LiveSummary> {
    const cacheId = `${editionId || 'default'}`;
    try {
      const cached = await cacheService.get<LiveSummary>('live_summary', cacheId, editionId);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Non-blocking cache lookup
    }

    try {
      const { data, error } = await supabase.rpc('get_championship_live_summary', {
        p_edition_id: editionId || null,
      });

      if (error) throw error;
      const summary = (data as LiveSummary) || {
        edition_name: 'ZIMRAH 2026',
        total_events: 34,
        published_results: 0,
        pending_results: 34,
        completion_pct: 0,
        top_churches: [],
        top_individuals: [],
        latest_results: [],
      };

      // Populate Redis cache with 60s TTL
      cacheService
        .set('live_summary', cacheId, summary, CacheService.LIVE_SUMMARY_TIMEOUT, editionId)
        .catch(() => {});

      return summary;
    } catch (err: unknown) {
      console.warn('Fallback: Error executing get_championship_live_summary RPC', err);
      return {
        edition_name: 'ZIMRAH 2026',
        total_events: 34,
        published_results: 0,
        pending_results: 34,
        completion_pct: 0,
        top_churches: [],
        top_individuals: [],
        latest_results: [],
      };
    }
  }

  /**
   * Fetches event-wise point contributions for a specific church.
   */
  async getChurchBreakdown(
    churchId: string,
    editionId?: string
  ): Promise<ChurchEventBreakdownItem[]> {
    const cacheId = `${editionId || 'default'}:${churchId}`;
    try {
      const cached = await cacheService.get<ChurchEventBreakdownItem[]>('church_breakdown', cacheId, editionId);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Fallback
    }

    try {
      const { data, error } = await supabase.rpc('get_church_event_breakdown', {
        p_church_id: churchId,
        p_edition_id: editionId || null,
      });

      if (error) throw error;
      const breakdown = (data || []) as ChurchEventBreakdownItem[];

      cacheService
        .set('church_breakdown', cacheId, breakdown, CacheService.DEFAULT_TIMEOUT, editionId)
        .catch(() => {});

      return breakdown;
    } catch (err: unknown) {
      console.warn('Fallback: Error executing get_church_event_breakdown RPC', err);
      return [];
    }
  }

  /**
   * Fetches event-wise point contributions for a specific contestant.
   */
  async getParticipantBreakdown(
    participantId: string,
    editionId?: string
  ): Promise<IndividualEventBreakdownItem[]> {
    const cacheId = `${editionId || 'default'}:${participantId}`;
    try {
      const cached = await cacheService.get<IndividualEventBreakdownItem[]>('participant_breakdown', cacheId, editionId);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Fallback
    }

    try {
      const { data, error } = await supabase.rpc('get_individual_event_breakdown', {
        p_participant_id: participantId,
        p_edition_id: editionId || null,
      });

      if (error) throw error;
      const breakdown = (data || []) as IndividualEventBreakdownItem[];

      cacheService
        .set('participant_breakdown', cacheId, breakdown, CacheService.DEFAULT_TIMEOUT, editionId)
        .catch(() => {});

      return breakdown;
    } catch (err: unknown) {
      console.warn('Fallback: Error executing get_individual_event_breakdown RPC', err);
      return [];
    }
  }
}

export const championshipService = new SupabaseChampionshipService();
