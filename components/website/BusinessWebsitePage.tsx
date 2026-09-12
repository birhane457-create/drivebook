/**
 * components/website/BusinessWebsitePage.tsx
 *
 * Generic public-facing website page for any business.
 * Driven by BusinessConfig — no driving vocabulary, no industry assumptions.
 *
 * Used by:
 *   - app/subdomain/[slug]/page.tsx     (subdomain routing)
 *   - app/custom-domain/page.tsx        (custom domain routing)
 *
 * The driving-specific subdomain page still handles existing instructor URLs.
 * This renderer is used when a BusinessConfig record exists with custom config.
 */

import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle, Instagram, Facebook, CheckCircle, Globe } from 'lucide-react'
import type { BusinessConfig } from '@/lib/core/types'
import WebsiteHero from './WebsiteHero'
import WebsiteServices from './WebsiteServices'
import WebsiteFAQ from './WebsiteFAQ'
import WebsiteReviews, { type Review } from './WebsiteReviews'

export interface ProviderPublicData {
  id: string
  displayName: string
  profileImage?: string | null
  bio?: string | null
  phone?: string | null
  serviceAreas?: string | null
  baseSuburb?: string | null
  averageRating?: number | null
  totalReviews: number
  yearsExperience?: number | null
  whatsapp?: string | null
  instagram?: string | null
  facebook?: string | null
  // Driving-specific — optional, only populated for driving businesses
  vehicleTypes?: string[]
}

export interface BusinessWebsitePageProps {
  config: BusinessConfig
  provider: ProviderPublicData
  reviews: Review[]
  nextAvailableSlots: string[]
  isAcceptingBookings: boolean
  // Canonical URL for SEO
  canonicalUrl?: string
}

export default function BusinessWebsitePage({
  config,
  provider,
  reviews,
  nextAvailableSlots,
  isAcceptingBookings,
  canonicalUrl,
}: BusinessWebsitePageProps) {
  const { terminology, branding, aiConfig, services } = config
  const primary   = branding.primaryColour   ?? '#3B82F6'
  const secondary = branding.secondaryColour ?? '#10B981'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {branding.logo ? (
              <Image src={branding.logo} alt={config.name} width={36} height={36} className="object-contain" />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground font-bold text-sm"
                style={{ background: primary }}
              >
                {config.name.charAt(0)}
              </div>
            )}
            <span className="font-bold text-gray-900 text-lg">{config.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {provider.whatsapp && (
              <a
                href={`https://wa.me/${provider.whatsapp.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            <Link href="/login" className="text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <WebsiteHero
        displayName={provider.displayName}
        profileImage={provider.profileImage}
        tagline={provider.bio?.split('.')[0]}
        serviceAreas={provider.serviceAreas}
        baseSuburb={provider.baseSuburb}
        averageRating={provider.averageRating}
        totalReviews={provider.totalReviews}
        yearsExperience={provider.yearsExperience}
        nextAvailableSlots={nextAvailableSlots}
        primaryColour={primary}
        secondaryColour={secondary}
        vehicleTypes={provider.vehicleTypes}
        isAcceptingBookings={isAcceptingBookings}
        providerLabel={terminology.provider}
        bookingLabel={terminology.booking}
      />

      {/* How it works strip */}
      {isAcceptingBookings && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 text-center">
              How booking works
            </p>
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
              {[
                { icon: '📋', title: `Choose a ${terminology.service.toLowerCase()}`, desc: `Select the ${terminology.service.toLowerCase()} that suits you` },
                { icon: '💳', title: 'Pay securely online', desc: 'Instant confirmation, no account needed' },
                { icon: '📅', title: 'You\'re confirmed', desc: `Your ${terminology.booking.toLowerCase()} is locked in` },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex flex-col items-center text-center gap-1.5">
                  <div className="text-2xl">{icon}</div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-muted-foreground leading-snug hidden sm:block">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">

            {/* About */}
            {provider.bio && (
              <div className="rounded-xl bg-white border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-2">About</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{provider.bio}</p>
              </div>
            )}

            {/* Opening hours from AI config */}
            {aiConfig.openingHours && (
              <div className="rounded-xl bg-white border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-2">Hours</h2>
                <p className="text-sm text-gray-600">{aiConfig.openingHours}</p>
              </div>
            )}

            {/* Contact */}
            <div className="rounded-xl bg-white border border-gray-200 p-5 space-y-2">
              <h2 className="font-semibold text-gray-900 mb-2">Contact</h2>
              {provider.phone && (
                <a href={`tel:${provider.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                  <span>📞</span> {provider.phone}
                </a>
              )}
              {config.supportEmail && (
                <a href={`mailto:${config.supportEmail}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                  <span>✉️</span> {config.supportEmail}
                </a>
              )}
              {provider.instagram && (
                <a href={`https://instagram.com/${provider.instagram}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                  <Instagram className="h-4 w-4" /> Instagram
                </a>
              )}
              {provider.facebook && (
                <a href={provider.facebook} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                  <Facebook className="h-4 w-4" /> Facebook
                </a>
              )}
            </div>

            {/* Trust */}
            <div className="rounded-xl bg-white border border-gray-200 p-5">
              <div className="space-y-2">
                {[
                  '🔒 Secure online booking',
                  '💳 Pay safely with card',
                  '📧 Instant confirmation',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">

            {/* Not accepting bookings banner */}
            {!isAcceptingBookings && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                This {terminology.provider.toLowerCase()} is not currently accepting new {terminology.bookings.toLowerCase()}.
              </div>
            )}

            {/* Services */}
            <WebsiteServices
              services={services}
              primaryColour={primary}
              bookingLabel={terminology.booking}
              providerLabel={terminology.provider}
              isAcceptingBookings={isAcceptingBookings}
            />

            {/* Booking entry point */}
            {isAcceptingBookings && (
              <div
                id="booking-form"
                className="rounded-xl border p-5 scroll-mt-20"
                style={{ background: `${primary}08`, borderColor: `${primary}30` }}
              >
                <h2 className="font-semibold text-gray-900 mb-1">
                  Book a {terminology.booking.toLowerCase()}
                </h2>
                <p className="text-sm text-muted-foreground/60 mb-4">
                  Select a {terminology.service.toLowerCase()} above and follow the booking steps.
                </p>
                <a
                  href={`/book/${provider.id}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-foreground transition-colors"
                  style={{ background: primary }}
                >
                  Book now →
                </a>
              </div>
            )}

            {/* Reviews */}
            {config.capabilities.reviews && (
              <WebsiteReviews
                reviews={reviews}
                primaryColour={primary}
                customerLabel={terminology.customer}
              />
            )}

            {/* FAQ */}
            <WebsiteFAQ faq={aiConfig.faq} primaryColour={primary} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground/60">
            <span className="font-medium text-gray-700">{config.name}</span>
            {config.abn && <span className="ml-2 text-muted-foreground">ABN {config.abn}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
            {!(branding as any).showPlatformBranding ? null : (
              <span>Powered by {process.env.NEXT_PUBLIC_PLATFORM_SLUG ?? 'Platform'}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
