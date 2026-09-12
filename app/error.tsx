'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log full error details server-side only — never expose to the client UI
    console.error(error)
  }, [error])

  // In production: show generic message — Prisma errors, stack traces, internal paths
  // must never be visible to end users.
  // In development: show the real message so devs can debug locally.
  const displayMessage =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again or contact support if the problem persists.'
      : error.message || 'An unexpected error occurred.'

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h1 className="text-4xl font-bold text-foreground mb-4">Something went wrong</h1>
        <p className="text-muted-foreground/60 mb-8">{displayMessage}</p>
        {error.digest && process.env.NODE_ENV !== 'production' && (
          <p className="text-xs text-slate-600 mb-4">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="bg-primary text-foreground px-6 py-2.5 rounded-lg hover:bg-primary/90 transition text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
