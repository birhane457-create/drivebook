/**
 * components/website/BusinessPublicPage.tsx
 *
 * WLA-012: Business-owned public page renderer.
 *
 * Renders a Business's public website from Business-level data loaded by
 * fetchBusinessWebsiteData(). Does NOT require a Provider record to exist.
 *
 * Used by app/custom-domain/page.tsx for the BusinessDomain resolution path.
 *
 * Differences from BusinessWebsitePage:
 *   - Accepts BusinessWebsiteData (Business-sourced) not BusinessWebsitePageProps (Provider-sourced)
 *   - Supports zero providers (standalone Business)
 *   - Supports multiple providers (multi-provider Business)
 *   - Renders SEO metadata from BusinessWebsite, not Provider fields
 *   - Uses terminology from BusinessTerminology, not BusinessConfig
 */

import Image from 'next/image';
import Link from 'next/link';
import { MessageCircle, Instagram, Facebook, Globe } from 'lucide-react';
import type { BusinessWebsiteData } from '@/lib/website/fetchBusinessWebsiteData';

interface BusinessPublicPageProps {
  data: BusinessWebsiteData;
}

export default function BusinessPublicPage({ data }: BusinessPublicPageProps) {
  const { business, branding, terminology, services, providers, canonicalUrl } = data;

  const primary   = branding.primaryColour ?? '#3B82F6';
  const secondary = branding.secondaryColour ?? '#10B981';
  const fontStyle = branding.fontFamily
    ? ({ fontFamily: branding.fontFamily } as React.CSSProperties)
    : undefined;
  const themeClass = branding.theme === 'dark' ? 'dark' : 'light';

  return (
    <div className={`min-h-screen bg-gray-50 ${themeClass}`} style={fontStyle}>
      {/* Nav */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {branding.logo ? (
              <Image
                src={branding.logo}
                alt={business.name}
                width={36}
                height={36}
                className="object-contain"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: primary }}
              >
                {business.name.charAt(0)}
              </div>
            )}
            <span className="font-bold text-gray-900 text-lg">{business.name}</span>
          </div>
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {business.phone}
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-white border-b border-gray-100 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {business.name}
          </h1>
          {data.seo.description && (
            <p className="text-lg text-gray-600 leading-relaxed">{data.seo.description}</p>
          )}
          {services.length > 0 && (
            <Link
              href="/book"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold text-base shadow hover:opacity-90 transition"
              style={{ background: primary }}
            >
              Book a {terminology.service}
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Services */}
        {services.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {terminology.services}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="rounded-xl bg-white border border-gray-200 p-5 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{svc.name}</h3>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                      ${Number(svc.price).toFixed(2)}
                    </span>
                  </div>
                  {svc.description && (
                    <p className="text-xs text-gray-500 leading-relaxed">{svc.description}</p>
                  )}
                  <p className="text-xs text-gray-400">{svc.duration} min</p>
                  <Link
                    href={`/book?service=${svc.id}`}
                    className="mt-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white text-center hover:opacity-90 transition"
                    style={{ background: primary }}
                  >
                    Book
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Providers — only shown when providers exist */}
        {providers.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Our {terminology.providers}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((prov) => (
                <div
                  key={prov.id}
                  className="rounded-xl bg-white border border-gray-200 p-5 flex flex-col gap-3"
                >
                  {prov.profileImage && (
                    <Image
                      src={prov.profileImage}
                      alt={prov.displayName}
                      width={56}
                      height={56}
                      className="rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{prov.displayName}</p>
                    {prov.yearsExperience && (
                      <p className="text-xs text-gray-500">
                        {prov.yearsExperience} years experience
                      </p>
                    )}
                    {prov.averageRating && (
                      <p className="text-xs text-gray-500">
                        ★ {prov.averageRating.toFixed(1)} ({prov.totalReviews} reviews)
                      </p>
                    )}
                  </div>
                  {prov.bio && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                      {prov.bio}
                    </p>
                  )}
                  {/* Social links */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {prov.whatsapp && (
                      <a
                        href={`https://wa.me/${prov.whatsapp.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    {prov.instagram && (
                      <a
                        href={`https://instagram.com/${prov.instagram.replace('@', '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-pink-600 hover:text-pink-700"
                        aria-label="Instagram"
                      >
                        <Instagram className="h-4 w-4" />
                      </a>
                    )}
                    {prov.facebook && (
                      <a
                        href={prov.facebook}
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                        aria-label="Facebook"
                      >
                        <Facebook className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Standalone Business — no providers */}
        {providers.length === 0 && services.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p>Website coming soon.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} {business.name}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
          </div>
          {branding.showPlatformBranding && (
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              <span>Powered by DriveBook</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
