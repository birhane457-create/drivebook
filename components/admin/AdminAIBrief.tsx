'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, DatabaseZap } from 'lucide-react'

interface Props {
  summaryData: Record<string, unknown> | null
}

export default function AdminAIBrief({ summaryData }: Props) {
  const [brief, setBrief] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [generated, setGenerated] = useState(false)

  const generate = async (forceRegenerate = false) => {
    if (!summaryData) return
    setLoading(true)
    setError(null)
    setBrief(null)
    setCached(false)

    try {
      const body = forceRegenerate
        ? { forceRegenerate: true, summary: summaryData }
        : summaryData

      const res = await fetch('/api/admin/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 503) {
          setError('setup_required')
        } else {
          setError(data.error ?? 'AI request failed')
        }
        return
      }

      setBrief(data.brief)
      setModel(data.model)
      setCached(data.cached === true)
      setGenerated(true)
    } catch {
      setError('Network error — could not reach AI service')
    } finally {
      setLoading(false)
    }
  }

  // ── Not yet generated ─────────────────────────────────────────────────────
  if (!generated && !loading && !error) {
    return (
      <div className="border border-slate-800 rounded-xl p-4 bg-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-slate-300">AI Operations Brief</span>
            <span className="text-xs text-slate-600">— powered by AI</span>
          </div>
          <button
            onClick={() => generate()}
            disabled={!summaryData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Brief
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          AI will analyse yesterday&apos;s data and write a plain-English operations summary with recommendations.
        </p>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="border border-slate-800 rounded-xl p-4 bg-slate-950">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <span className="text-sm text-slate-400">Generating AI brief&hellip;</span>
        </div>
      </div>
    )
  }

  // ── Setup required (no API key) ───────────────────────────────────────────
  if (error === 'setup_required') {
    return (
      <div className="border border-violet-700/30 rounded-xl p-4 bg-violet-900/10">
        <div className="flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-300">AI Brief not configured</p>
            <p className="text-xs text-slate-400 mt-1">
              Add <code className="bg-slate-800 px-1 py-0.5 rounded text-violet-300">OPENAI_API_KEY</code> or{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-violet-300">ANTHROPIC_API_KEY</code> to your{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">.env</code> file to enable AI-generated summaries.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="border border-red-700/30 rounded-xl p-4 bg-red-900/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={() => generate()}
            className="text-xs text-red-400 hover:text-red-200 underline shrink-0 ml-3"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <div className="border border-violet-700/30 rounded-xl bg-violet-900/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-violet-700/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">AI Operations Brief</span>
          {model && (
            <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{model}</span>
          )}
          {cached && (
            <span
              className="flex items-center gap-1 text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded"
              title="Loaded from today's saved brief — no LLM call made"
            >
              <DatabaseZap className="w-3 h-3" /> cached
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => generate(true)}
            className="text-xs text-slate-500 hover:text-violet-400 transition"
            title="Regenerate and overwrite today's brief"
          >
            Regenerate
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && brief && (
        <div className="px-4 py-4">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{brief}</p>
        </div>
      )}
    </div>
  )
}
