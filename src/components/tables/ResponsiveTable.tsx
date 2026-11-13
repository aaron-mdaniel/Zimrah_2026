import React from 'react';
import { Table } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

interface ResponsiveTableProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  isLoading,
  isEmpty,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching the current criteria.',
  children,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <LoadingSpinner text="Loading records..." />
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <Table>{children}</Table>
    </div>
  );
};
