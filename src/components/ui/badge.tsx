import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zim-primary text-white shadow',
        secondary: 'border-transparent bg-amber-100 text-amber-900 border-amber-200',
        destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
        outline: 'text-foreground border-slate-300',
        success: 'border-transparent bg-emerald-100 text-emerald-800 border-emerald-200',
        warning: 'border-transparent bg-orange-100 text-orange-800 border-orange-200',
        gold: 'border-transparent bg-amber-400 text-zinc-950 font-bold shadow-sm',
        silver: 'border-transparent bg-slate-200 text-slate-800 font-bold',
        bronze: 'border-transparent bg-amber-700 text-white font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
