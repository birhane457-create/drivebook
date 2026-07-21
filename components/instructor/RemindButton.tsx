'use client'

import { useState } from 'react'
import { Send, CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  bookingId: string
  clientId: string
  clientFirstName: string
}

export default function RemindButton({ bookingId, clientId, clientFirstName }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

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
        // Reset after 4 seconds so it can be used again (next visit)
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

  return (
    <button
      onClick={handleRemind}
      disabled={state === 'sending'}
      className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1 text-xs font-semibold text-white transition"
    >
      {state === 'sending'
        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
        : <><Send className="h-3.5 w-3.5" />Remind</>
      }
    </button>
  )
}
