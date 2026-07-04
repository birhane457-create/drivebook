import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ErrorState({ icon: Icon = AlertTriangle, title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" /> Try again
        </Button>
      )}
    </div>
  );
}