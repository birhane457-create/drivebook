/**
 * components/website/WebsiteReviews.tsx
 *
 * Generic reviews section. No driving vocabulary.
 */

import { Star } from 'lucide-react'

export interface Review {
  customerName?: string | null
  customerRating?: number | null
  startTime?: Date | string | null
}

export interface WebsiteReviewsProps {
  reviews: Review[]
  primaryColour: string
  customerLabel: string  // "Learner" | "Client" | "Customer"
}

export default function WebsiteReviews({ reviews, primaryColour, customerLabel }: WebsiteReviewsProps) {
  if (reviews.length === 0) return null

  return (
    <div id="reviews">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        What {customerLabel}s say
      </h2>
      <div className="space-y-3">
        {reviews.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className={`h-4 w-4 ${j < (r.customerRating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                  />
                ))}
              </div>
              {r.customerName && (
                <span className="text-sm font-medium text-gray-700">{r.customerName}</span>
              )}
            </div>
            {r.customerRating && (
              <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{r.customerRating}&rdquo;</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
