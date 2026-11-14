/**
 * ZIMRAH 2026 – Supabase Realtime Sync Hook
 * ADR-008: Seamless synchronization between PostgreSQL state and TanStack Query cache.
 * Subscribes to database mutations on event_results, point_ledger, churches, and events.
 * Automatically purges CacheService generation and invalidates public and admin queries.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cacheService } from '@/services/cacheService';

export const useRealtimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('zimrah_realtime_broadcast')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_results' },
        async () => {
          await cacheService.invalidateAll(undefined, 'REALTIME_RESULTS_CHANGE').catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['live-summary'] });
          queryClient.invalidateQueries({ queryKey: ['home-published-results'] });
          queryClient.invalidateQueries({ queryKey: ['public-published-results'] });
          queryClient.invalidateQueries({ queryKey: ['church-standings'] });
          queryClient.invalidateQueries({ queryKey: ['individual-standings'] });
          queryClient.invalidateQueries({ queryKey: ['admin-results-status'] });
          queryClient.invalidateQueries({ queryKey: ['admin-event-result-detail'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'point_ledger' },
        async () => {
          await cacheService.invalidateAll(undefined, 'REALTIME_LEDGER_CHANGE').catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['live-summary'] });
          queryClient.invalidateQueries({ queryKey: ['church-standings'] });
          queryClient.invalidateQueries({ queryKey: ['individual-standings'] });
          queryClient.invalidateQueries({ queryKey: ['admin-church-standings'] });
          queryClient.invalidateQueries({ queryKey: ['admin-individual-standings'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'churches' },
        async () => {
          await cacheService.invalidateAll(undefined, 'REALTIME_CHURCHES_CHANGE').catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['admin-churches'] });
          queryClient.invalidateQueries({ queryKey: ['churches-active'] });
          queryClient.invalidateQueries({ queryKey: ['church-standings'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        async () => {
          await cacheService.invalidateAll(undefined, 'REALTIME_EVENTS_CHANGE').catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['admin-events'] });
          queryClient.invalidateQueries({ queryKey: ['public-events-catalog'] });
          queryClient.invalidateQueries({ queryKey: ['public-events-list'] });
          queryClient.invalidateQueries({ queryKey: ['search-events'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
