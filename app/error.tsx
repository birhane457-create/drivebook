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
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-300 mb-4">Something went wrong</h1>
        <p className="text-slate-500 mb-8">{error.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
