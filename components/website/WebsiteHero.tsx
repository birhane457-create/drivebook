/**
 * components/website/WebsiteHero.tsx
 *
 * Generic hero section for a provider's public website.
 * Driven entirely by BusinessConfig + provider data — no driving vocabulary.
 */

import Image from 'next/image'
import { MapPin, Star, Calendar, Users, Award } from 'lucide-react'

export interface WebsiteHeroProps {
  displayName: string
  profileImage?: string | null
  tagline?: string | null
  serviceAreas?: string | null
  baseSuburb?: string | null
  averageRating?: number | null
  totalReviews: number
  yearsExperience?: number | null
  nextAvailableSlots: string[]
  primaryColour: string
  secondaryColour: string
  vehicleTypes?: string[] // driving-specific — only shown if provided
  isAcceptingBookings: boolean
  // Terminology from BusinessConfig
  providerLabel: string       // "Instructor" | "Tax Agent" | "Therapist"
  bookingLabel: string        // "Lesson" | "Consultation" | "Appointment"
}

export default function WebsiteHero({
  displayName, profileImage, tagline, serviceAreas, baseSuburb,
  averageRating, totalReviews, yearsExperience, nextAvailableSlots,
  primaryColour, secondaryColour, vehicleTypes, isAcceptingBookings,
  providerLabel, bookingLabel,
}: WebsiteHeroProps) {
  return (
    <div
      className="relative h-48 sm:h-64 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primaryColour}dd, ${secondaryColour}cc)` }}
    >
      <div className="relative z-10 h-full flex items-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6">
          {/* Profile image */}
          <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-full overflow-hidden border-4 border-white shadow-lg shrink-0">
            {profileImage ? (
              <Image src={profileImage} alt={displayName} fill className="object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-4xl font-bold text-foreground"
                style={{ background: primaryColour }}
              >
                {displayName.charAt(0)}
              </div>
            )}
          </div>

          <div className="text-foreground">
            <h1 className="text-2xl sm:text-3xl font-bold">{displayName}</h1>

            {/* Rating */}
            <div className="flex items-center gap-1 mt-1">
              {totalReviews > 0 ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(averageRating ?? 5) ? 'fill-white text-foreground' : 'text-foreground/40'}`}
                    />
                  ))}
                  <span className="ml-1 text-sm text-foreground/80">
                    {averageRating?.toFixed(1)} · {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-foreground/70 bg-secondary px-2 py-0.5 rounded-full">
                  New {providerLabel.toLowerCase()}
                </span>
              )}
            </div>

            {/* Location */}
            {(serviceAreas || baseSuburb) && (
              <div className="flex items-center gap-1 mt-1 text-foreground/80 text-sm">
                <MapPin className="h-3.5 w-3.5" />
                {serviceAreas || baseSuburb}
              </div>
            )}

            {/* Vehicle types — only shown for driving */}
            {vehicleTypes && vehicleTypes.length > 0 && (
              <div className="flex items-center gap-1 mt-1 text-foreground/70 text-xs">
                <span>{vehicleTypes.join(' & ')} lessons</span>
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2">
              {yearsExperience && (
                <div className="flex items-center gap-1 text-foreground/90 text-xs">
                  <Award className="h-3.5 w-3.5" />
                  {yearsExperience}+ yrs experience
                </div>
              )}
              {totalReviews > 0 && (
                <div className="flex items-center gap-1 text-foreground/90 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  {totalReviews} clients
                </div>
              )}
              {nextAvailableSlots[0] && (
                <div className="flex items-center gap-1 text-foreground/90 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  {nextAvailableSlots[0]}
                </div>
              )}
            </div>

            {/* CTA */}
            {isAcceptingBookings && (
              <div className="mt-4">
                <a
                  href="#booking-form"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 border border-white/30 text-foreground transition-all"
                >
                  <Calendar className="h-4 w-4" />
                  Book a {bookingLabel.toLowerCase()}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
