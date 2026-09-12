'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Signal, severityToVariant, severityToIconColor } from '@/lib/types/signal'

/**
 * AttentionItemList — Canonical renderer for Signal[] arrays.
 * Consumes the shared Signal type from lib/types/signal.ts.
 * 
 * Both admin dashboard and daily summary now construct Signal[] arrays
 * with computed severity, then pass them here for consistent rendering.
 */

interface AttentionItemListProps {
  /** Array of Signal objects (from admin dashboard, API, or task queue) */
  items: Signal[]
  /** Empty state message */
  emptyMessage?: string
}

export default function AttentionItemList({
  items,
  emptyMessage,
}: AttentionItemListProps) {
  if (items.length === 0) {
    return emptyMessage ? (
      <p className="text-sm text-muted-foreground/60 text-center py-4">{emptyMessage}</p>
    ) : null
  }

  return (
    <div className="space-y-2">
      {items.map((signal) => {
        const variant = severityToVariant(signal.severity)
        const iconColor = severityToIconColor(signal.severity)
        const icon = signal.icon ?? <AlertTriangle className={`w-4 h-4 shrink-0 ${iconColor}`} />

        const content = (
          <>
            {icon}
            <div className="flex-1">
              <AlertTitle>{signal.title}</AlertTitle>
              {signal.description && (
                <AlertDescription>
                  {signal.description}
                  {signal.linkText && (
                    <> <Link href={signal.link} className="underline hover:no-underline">{signal.linkText}</Link></>
                  )}
                </AlertDescription>
              )}
              {!signal.description && signal.linkText && (
                <AlertDescription>
                  <Link href={signal.link} className="underline hover:no-underline">{signal.linkText}</Link>
                </AlertDescription>
              )}
            </div>
          </>
        )

        // If no linkText, wrap entire alert in link
        return signal.linkText ? (
          <Alert key={signal.id} variant={variant}>
            {content}
          </Alert>
        ) : (
          <Link key={signal.id} href={signal.link} className="block no-underline">
            <Alert variant={variant} className="hover:opacity-90 transition cursor-pointer">
              {content}
            </Alert>
          </Link>
        )
      })}
    </div>
  )
}
