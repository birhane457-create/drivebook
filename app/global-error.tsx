'use client'

import { useEffect } from 'react'

export default function GlobalError({
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
    <html>
      <body style={{ margin: 0, background: '#020617', color: '#f1f5f9', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Something went wrong</h1>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>{error.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={reset}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.625rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
