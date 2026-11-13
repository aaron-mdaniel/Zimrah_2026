import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, placeholder = 'Search...', ...props }, ref) => {
    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-zim-primary focus:border-transparent transition-all"
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
