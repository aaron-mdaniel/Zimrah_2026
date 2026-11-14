import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5, // 5 seconds fresh
      gcTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: true, // Auto-refetch when user focuses or returns to tab
      retry: 1,
    },
  },
});
