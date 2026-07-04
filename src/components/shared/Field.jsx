import { cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export default function Field({ label, required, error, help, htmlFor, children, className }) {
  const decorated = isValidElement(children)
    ? cloneElement(children, {
        id: htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': help || error ? `${htmlFor}-msg` : undefined,
        className: cn(children.props?.className, error && 'border-destructive focus-visible:ring-destructive/40'),
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium flex items-center gap-0.5">
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      {decorated}
      {(error || help) && (
        <p id={`${htmlFor}-msg`} className={cn("text-xs flex items-start gap-1", error ? "text-destructive" : "text-muted-foreground")}>
          {error && <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
          <span>{error || help}</span>
        </p>
      )}
    </div>
  );
}