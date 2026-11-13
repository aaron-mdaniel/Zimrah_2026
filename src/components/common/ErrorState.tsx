import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while fetching information.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-red-50/50 rounded-xl border border-red-200 ${className}`}>
      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-red-900 mb-1">{title}</h3>
      <p className="text-sm text-red-600 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2 border-red-200 text-red-800 hover:bg-red-100">
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </Button>
      )}
    </div>
  );
};
