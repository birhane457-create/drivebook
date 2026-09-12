/**
 * components/website/WebsiteFAQ.tsx
 *
 * Generic FAQ section — driven by BusinessConfig.aiConfig.faq.
 * No driving vocabulary. Works for any business type.
 */

'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FAQEntry } from '@/lib/core/types'

export interface WebsiteFAQProps {
  faq: FAQEntry[]
  primaryColour: string
}

export default function WebsiteFAQ({ faq, primaryColour }: WebsiteFAQProps) {
  const [open, setOpen] = useState<number | null>(null)
  if (faq.length === 0) return null

  return (
    <div id="faq">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Frequently Asked Questions</h2>
      <div className="space-y-2">
        {faq.map((entry, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="text-sm font-medium text-gray-900">{entry.question}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                {entry.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
