import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />;
      default:
        return <Info className="h-6 w-6 text-blue-500 flex-shrink-0" />;
    }
  };

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-3">
          {getIcon()}
          <DialogTitle className="text-slate-900 text-lg font-bold">{title}</DialogTitle>
        </div>
        <DialogDescription className="text-slate-600 text-sm mt-2">
          {description}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="mt-6 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={getConfirmButtonVariant()}
          onClick={async () => {
            await onConfirm();
          }}
          disabled={isLoading}
          className="font-semibold"
        >
          {isLoading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
