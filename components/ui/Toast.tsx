'use client';

/**
 * Toast — shared notification component for the DriveBook dashboard.
 *
 * Renders a fixed top-right toast that auto-dismisses.
 * Designed to be used with the useToast() hook.
 *
 * Usage:
 *   import Toast from '@/components/ui/Toast'
 *   import { useToast } from '@/hooks/useToast'
 *
 *   const { toast, showToast, clearToast } = useToast()
 *   showToast('error', 'Failed to send payment link.')
 *   <Toast toast={toast} onClose={clearToast} />
 */

import { CheckCircle, AlertCircle, X } from 'lucide-react';
import type { ToastState } from '@/hooks/useToast';

interface ToastProps {
  toast: ToastState;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-sm
        ${isSuccess ? 'bg-green-600' : 'bg-red-600'}`}
    >
      {isSuccess
        ? <CheckCircle className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />
      }
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
