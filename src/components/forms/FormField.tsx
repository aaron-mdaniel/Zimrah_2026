import React from 'react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  helpText,
  children,
  className,
}) => {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {helpText && !error && (
        <p className="text-xs text-slate-500">{helpText}</p>
      )}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};
