/**
 * components/website/WebsiteServices.tsx
 *
 * Generic services section — shows the business's service catalogue.
 * Driven by BusinessConfig.services — works for any business type.
 */

import type { ServiceDefinition } from '@/lib/core/types'
import { Clock, MapPin, Phone, Globe, Users } from 'lucide-react'

const LOCATION_LABELS: Record<string, string> = {
  provider_travels: 'We come to you',
  customer_travels: 'Visit our location',
  remote:           'Remote / online',
  flexible:         'Flexible location',
}

export interface WebsiteServicesProps {
  services: ServiceDefinition[]
  primaryColour: string
  bookingLabel: string    // "Lesson" | "Appointment" | "Consultation"
  providerLabel: string
  isAcceptingBookings: boolean
}

export default function WebsiteServices({
  services, primaryColour, bookingLabel, providerLabel, isAcceptingBookings,
}: WebsiteServicesProps) {
  if (services.length === 0) return null

  return (
    <div id="services" className="scroll-mt-16">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Services</h2>
      <div className="space-y-3">
        {services.map(svc => (
          <div
            key={svc.id}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
              {svc.description && (
                <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">{svc.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {svc.duration > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Clock className="h-3 w-3" />
                    {svc.duration >= 60
                      ? `${svc.duration / 60}h${svc.duration % 60 > 0 ? ` ${svc.duration % 60}m` : ''}`
                      : `${svc.duration}min`}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                  <MapPin className="h-3 w-3" />
                  {LOCATION_LABELS[svc.locationMode] ?? svc.locationMode}
                </span>
                {svc.paymentRules.quoteRequired && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    Quote required
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {svc.price > 0 ? (
                <span className="text-lg font-bold text-gray-900">${svc.price}</span>
              ) : svc.paymentRules.quoteRequired ? (
                <span className="text-sm font-medium text-muted-foreground/60">POA</span>
              ) : null}
              {isAcceptingBookings && (
                <div className="mt-2">
                  <a
                    href="#booking-form"
                    className="block text-xs font-medium px-3 py-1.5 rounded-lg text-foreground transition-colors"
                    style={{ background: primaryColour }}
                  >
                    Book
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
