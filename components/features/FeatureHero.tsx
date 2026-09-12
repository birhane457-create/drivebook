import Link from 'next/link'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface FeatureHeroProps {
  /** Background gradient colors - e.g., "from-pink-900 via-violet-900 to-slate-950" */
  gradientClasses: string
  /** Badge icon */
  badgeIcon: LucideIcon
  /** Badge text */
  badgeText: string
  /** Badge colors - e.g., "bg-pink-500/20 border-pink-500/30 text-pink-300" */
  badgeColors: string
  /** Main heading */
  title: ReactNode
  /** Subtitle/description */
  description: string
  /** Primary CTA href */
  ctaHref: string
  /** Primary CTA text */
  ctaText: string
  /** Primary CTA gradient - e.g., "from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500" */
  ctaGradient: string
  /** Shadow color for CTA - e.g., "shadow-pink-500/20" */
  ctaShadow?: string
  /** Optional secondary link */
  secondaryLink?: {
    href: string
    text: string
  }
  /** Optional breadcrumb path */
  breadcrumb?: {
    parent: string
    parentHref: string
    current: string
  }
  /** Optional decorative blob color - e.g., "bg-pink-500/20" */
  blobColor?: string
}

/**
 * Unified feature page hero with dark gradient background and white text.
 * Always renders white text regardless of light/dark theme.
 */
export default function FeatureHero({
  gradientClasses,
  badgeIcon: BadgeIcon,
  badgeText,
  badgeColors,
  title,
  description,
  ctaHref,
  ctaText,
  ctaGradient,
  ctaShadow = '',
  secondaryLink,
  breadcrumb,
  blobColor = 'bg-white/10',
}: FeatureHeroProps) {
  return (
    <section className={`relative overflow-hidden bg-gradient-to-br ${gradientClasses} py-20 md:py-28 px-4`}>
      {/* Decorative blob */}
      <div className={`absolute top-0 right-1/4 w-96 h-96 ${blobColor} rounded-full blur-3xl -translate-y-1/2`} />
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Breadcrumb */}
        {breadcrumb && (
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
            <Link href="/" className="hover:text-white/70 no-underline transition-colors">Home</Link>
            <span>/</span>
            <Link href={breadcrumb.parentHref} className="hover:text-white/70 no-underline transition-colors">{breadcrumb.parent}</Link>
            <span>/</span>
            <span className="text-white/60">{breadcrumb.current}</span>
          </nav>
        )}

        {/* Badge */}
        <div className={`inline-flex items-center gap-2 ${badgeColors} rounded-full px-4 py-1.5 mb-6 border`}>
          <BadgeIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wider">{badgeText}</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
          {title}
        </h1>

        {/* Description */}
        <p className="text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
          {description}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link 
            href={ctaHref} 
            className={`bg-gradient-to-r ${ctaGradient} text-white px-8 py-4 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg ${ctaShadow} text-center`}
          >
            {ctaText}
          </Link>
          
          {secondaryLink && (
            <Link 
              href={secondaryLink.href} 
              className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-semibold no-underline transition-all border border-white/20 text-center backdrop-blur-sm"
            >
              {secondaryLink.text}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
