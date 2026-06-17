'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Loader2, Sparkles, User, AlertCircle, RotateCcw } from 'lucide-react'
import { getDisplayQuestions, QUESTION_CATEGORIES, type SuggestedQuestion } from '@/lib/admin/suggested-questions'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  toolsUsed?: string[]
  timestamp: Date
}

type CategoryFilter = SuggestedQuestion['category'] | 'all'

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all:         'All',
  operations:  'Operations',
  revenue:     'Revenue',
  instructors: 'Instructors',
  students:    'Students',
  platform:    'Platform',
}

function ToolPill({ name }: { name: string }) {
  const label = name.replace(/^get/, '').replace(/([A-Z])/g, ' $1').trim()
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-slate-800 text-slate-500 border border-slate-700">
      <Sparkles className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser  = message.role === 'user'
  const isError = message.role === 'error'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-2.5">
            <p className="text-sm text-white">{message.content}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-violet-400" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="bg-red-900/20 border border-red-700/40 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
          <p className="text-sm text-red-300">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-violet-400" />
      </div>
      <div className="max-w-[85%] space-y-1.5">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{message.content}</p>
        </div>
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.toolsUsed.map((t) => <ToolPill key={t} name={t} />)}
          </div>
        )}
        <p className="text-xs text-slate-600 px-1">
          {message.timestamp.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function SuggestedQuestions({ onSelect }: { onSelect: (q: string) => void }) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  const questions = activeCategory === 'all'
    ? getDisplayQuestions({ limit: 6 })
    : getDisplayQuestions({ category: activeCategory as SuggestedQuestion['category'], limit: 8 })

  return (
    <div className="px-5 pb-3 shrink-0 space-y-2">
      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
        {(['all', ...QUESTION_CATEGORIES] as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition capitalize ${
              activeCategory === cat
                ? 'bg-violet-600/30 text-violet-300 border border-violet-600/50'
                : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Question chips */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => (
          <button
            key={q.question}
            onClick={() => onSelect(q.question)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition text-left"
          >
            {q.question}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AdminAIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "G'day! I'm your DriveBook Operations Copilot. I have access to live platform data — ask me anything about bookings, revenue, instructor performance, or operational issues.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Check AI configuration on mount (lightweight probe)
  useEffect(() => {
    fetch('/api/admin/ai-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '__ping__' }] }),
    }).then(r => setConfigured(r.status !== 503)).catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const res  = await fetch('/api/admin/ai-query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`, role: 'error',
          content: data.error ?? 'Something went wrong. Please try again.',
          timestamp: new Date(),
        }])
        return
      }

      setMessages((prev) => [...prev, {
        id:        `assistant-${Date.now()}`,
        role:      'assistant',
        content:   data.reply,
        toolsUsed: data.toolsUsed,
        timestamp: new Date(),
      }])
    } catch {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`, role: 'error',
        content:   'Network error — could not reach the AI service.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const reset = () => {
    setMessages([{
      id: 'welcome', role: 'assistant',
      content: "G'day! I'm your DriveBook Operations Copilot. I have access to live platform data — ask me anything about bookings, revenue, instructor performance, or operational issues.",
      timestamp: new Date(),
    }])
    setInput('')
  }

  const showSuggestions = messages.length === 1 && !loading

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col" style={{ height: '620px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Operations Copilot</h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                configured === null ? 'bg-slate-600' : configured ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`} />
              <p className="text-xs text-slate-500">
                {configured === null ? 'Checking…' : configured ? 'AI connected · Live data' : 'AI not configured'}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={reset}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
          title="Clear conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Not configured banner */}
      {configured === false && (
        <div className="px-5 py-3 bg-violet-900/20 border-b border-violet-700/30 shrink-0">
          <p className="text-xs text-violet-300">
            Add <code className="bg-slate-800 px-1 rounded">OPENAI_API_KEY</code> or{' '}
            <code className="bg-slate-800 px-1 rounded">ANTHROPIC_API_KEY</code> to your .env to enable AI chat.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span className="text-sm text-slate-400">Querying platform data…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions with category filter */}
      {showSuggestions && <SuggestedQuestions onSelect={(q) => send(q)} />}

      {/* Input */}
      <div className="px-4 pb-4 shrink-0 border-t border-slate-800 pt-3">
        <div className="flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-xl p-2 focus-within:border-violet-600/60 transition">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about platform operations…"
            rows={1}
            disabled={loading || configured === false}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none outline-none py-1 px-2 max-h-32"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading || configured === false}
            className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-700 mt-1.5 px-1">Enter to send · Shift+Enter for new line · Read-only · All queries are logged</p>
      </div>
    </div>
  )
}
