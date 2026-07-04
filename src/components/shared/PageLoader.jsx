import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageLoader({ label = 'Loading...', fullscreen = false, className }) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}