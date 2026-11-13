import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />
      {/* Dialog content */}
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>
  );
};

const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div className={cn('w-full', className)} {...props} />
);

const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)}
    {...props}
  />
);

const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h2
    className={cn('text-lg font-bold leading-none tracking-tight text-slate-900', className)}
    {...props}
  />
);

const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p className={cn('text-sm text-slate-500', className)} {...props} />
);

const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6', className)}
    {...props}
  />
);

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
