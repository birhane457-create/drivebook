/**
 * useToast — shared toast hook for the DriveBook dashboard.
 *
 * Before this hook existed, every page defined its own inline:
 *   const [toast, setToast] = useState<...>(null)
 *   const showToast = (type, message) => { setToast(...); setTimeout(...) }
 *
 * Usage:
 *   const { toast, showToast } = useToast()
 *   showToast('error', 'Failed to send payment link.')
 *   showToast('success', 'Settings saved.')
 *
 * Render the notification:
 *   import Toast from '@/components/ui/Toast'
 *   <Toast toast={toast} onClose={clearToast} />
 */

import { useState, useCallback } from 'react';

export type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

const DEFAULT_DURATION_MS = 4000;

export function useToast(durationMs: number = DEFAULT_DURATION_MS) {
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), durationMs);
    },
    [durationMs]
  );

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, showToast, clearToast };
}
