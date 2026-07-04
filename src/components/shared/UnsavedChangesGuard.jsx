import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';

export default function UnsavedChangesGuard({ dirty, saving, onSave, onDiscard }) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-30 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 shadow-lg">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">You have unsaved changes</span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Saving...' : 'Save now'}
        </Button>
      </div>
    </div>
  );
}