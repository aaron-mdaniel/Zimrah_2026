import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 15,
  onPageChange,
  className = '',
}) => {
  if (totalPages <= 1 && (!totalItems || totalItems <= pageSize)) {
    return null;
  }

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const startItem = totalItems ? Math.min((currentPage - 1) * pageSize + 1, totalItems) : 0;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 ${className}`}>
      {totalItems !== undefined && (
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-semibold text-slate-800">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> records
        </div>
      )}

      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-slate-600 disabled:opacity-40"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First Page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-slate-600 disabled:opacity-40"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageNumbers().map((item, idx) =>
          typeof item === 'number' ? (
            <Button
              key={`page-${item}`}
              variant={currentPage === item ? 'default' : 'outline'}
              size="sm"
              className={`h-8 w-8 p-0 text-xs font-semibold ${
                currentPage === item
                  ? 'bg-zim-primary hover:bg-zim-primary/90 text-white font-bold'
                  : 'text-slate-700'
              }`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ) : (
            <span key={`dots-${idx}`} className="px-2 text-xs text-slate-400">
              ...
            </span>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-slate-600 disabled:opacity-40"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-slate-600 disabled:opacity-40"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
