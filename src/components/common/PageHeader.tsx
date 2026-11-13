import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 font-medium">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
};
