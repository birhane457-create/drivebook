import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border',
  {
    variants: {
      variant: {
        default:     'bg-primary/20 text-blue-300 border-primary/30',
        secondary:   'bg-secondary text-muted-foreground border-border',
        outline:     'bg-transparent text-foreground border-border',
        destructive: 'bg-destructive/20 text-red-300 border-destructive/30',
        success:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        warning:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
        violet:      'bg-violet-500/20 text-violet-300 border-violet-500/30',
        sky:         'bg-sky-500/20 text-sky-300 border-sky-500/30',
        info:        'bg-sky-500/20 text-sky-300 border-sky-500/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
