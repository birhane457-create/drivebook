'use client'

import { useState } from 'react'
import { Send, CheckCircle, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'

interface Props {
  bookingId: string
  clientId: string
  clientFirstName: string
}

export default function RemindButton({ bookingId, clientId, clientFirstName }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const { canSendClientReminder, loading: permLoading } = usePermissions()

  const handleRemind = async () => {
    if (state !== 'idle') return
    setState('sending')
    try {
      const res = await fetch('/api/instructor/remind-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, clientId }),
      })
      const data = await res.json()
      if (res.ok) {
        setState('sent')
        setTimeout(() => setState('idle'), 4000)
      } else if (res.status === 429) {
        setState('error')
        setErrorMsg('Already reminded today')
        setTimeout(() => setState('idle'), 4000)
      } else {
        setState('error')
        setErrorMsg(data.error ?? 'Could not send')
        setTimeout(() => setState('idle'), 4000)
      }
    } catch {
      setState('error')
      setErrorMsg('Network error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  if (state === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 px-3 py-1 text-xs font-semibold text-emerald-300">
        <CheckCircle className="h-3.5 w-3.5" />
        Sent
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-900/30 border border-red-700/40 px-3 py-1 text-xs font-semibold text-red-300">
        {errorMsg}
      </span>
    )
  }

  // Not permitted — show inline lock with tooltip
  if (!permLoading && !canSendClientReminder) {
    return (
      <div className="relative inline-block group">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 px-3 py-1 text-xs font-semibold text-slate-500 cursor-not-allowed">
          <Lock className="h-3 w-3" />
          Remind
        </span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:flex flex-col items-center pointer-events-none">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl px-3 py-2 text-xs text-slate-200 whitespace-nowrap">
            <p className="font-medium text-amber-300 mb-1">Verify your account to send reminders</p>
            <Link href="/dashboard/documents" className="text-sky-400 hover:text-sky-300 underline pointer-events-auto">
              Upload documents →
            </Link>
          </div>
          <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1" />
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleRemind}
      disabled={state === 'sending' || permLoading}
      className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1 text-xs font-semibold text-white transition"
    >
      {state === 'sending'
        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
        : <><Send className="h-3.5 w-3.5" />Remind</>
      }
    </button>
  )
}
