import React from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/toast';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const RealtimeSyncBridge: React.FC = () => {
  useRealtimeSync();
  return null;
};

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <RealtimeSyncBridge />
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};
