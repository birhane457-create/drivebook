import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const alertVariants = cva(
  'relative w-full rounded-xl border px-4 py-3 text-sm flex items-start gap-3',
  {
    variants: {
      variant: {
        default:     'bg-secondary border-border text-foreground',
        destructive: 'bg-destructive/10 border-destructive/30 text-red-300',
        warning:     'bg-amber-500/10 border-amber-500/30 text-amber-300',
        success:     'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
        info:        'bg-primary/10 border-primary/30 text-blue-300',
        violet:      'bg-violet-500/10 border-violet-500/30 text-violet-300',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('font-semibold leading-none mb-1', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs leading-relaxed opacity-90', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
