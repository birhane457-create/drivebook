'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

/**
 * Silently syncs subscription state from Stripe after:
 * - Returning from Stripe Billing Portal (?portal_return=true)
 * - Successfully adding a payment method (?payment_added=true)
 * - Successful checkout (?success=true)
 *
 * Calls POST /api/instructor/subscription/sync, then hard-reloads
 * the page so the server-side layout re-reads the updated DB state
 * and removes the ReadOnlyBanner.
 */
export default function SubscriptionSyncTrigger() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const shouldSync =
      searchParams.get('portal_return') === 'true' ||
      searchParams.get('payment_added') === 'true' ||
      searchParams.get('success') === 'true'

    if (!shouldSync) return

    // Remove the query params immediately so a page refresh doesn't re-trigger
    const url = new URL(window.location.href)
    url.searchParams.delete('portal_return')
    url.searchParams.delete('payment_added')
    url.searchParams.delete('success')
    window.history.replaceState({}, '', url.toString())

    // Call sync endpoint then hard-reload so the server layout re-reads DB
    fetch('/api/instructor/subscription/sync', { method: 'POST' })
      .then(() => {
        // Hard reload — forces the server component layout to re-render
        // with the updated subscription status from DB
        window.location.reload()
      })
      .catch(() => {
        // Sync failed — still reload so webhook-driven update can show
        window.location.reload()
      })
  }, [searchParams])

  return null
}
