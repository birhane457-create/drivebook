import React from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { cn } from '@/lib/cn'

/**
 * PublicLayout
 *
 * Wraps all public-facing pages (landing, driving-lessons, teach-with-drivebook,
 * features, auth etc.) with:
 *   - class="light" on the root div → activates the .light CSS token block
 *   - Sticky top nav — logo, page links, primary CTA
 *   - Consistent footer
 *
 * Content inside automatically inherits the light theme:
 *   bg-background  → near-white page
 *   bg-card        → pure white card
 *   text-foreground → near-black
 *   text-muted-foreground → dark grey (readable in daylight)
 *   border-border  → very soft grey
 *
 * Dark gradient hero sections inside this layout should use the
 * `.section-hero` or `.section-hero-emerald` CSS utility classes
 * which pin their own bg/text regardless of the parent theme.
 */

interface PublicLayoutProps {
  children: React.ReactNode
  /** Override nav variant for specific pages */
  navVariant?: 'default' | 'instructor' | 'student'
  /** Hide the footer (e.g. full-screen auth pages) */
  hideFooter?: boolean
  className?: string
}

const NAV_LINKS = {
  default: [
    { href: '/driving-lessons',        label: 'Find Instructors' },
    { href: '/teach-with-drivebook',   label: 'For Instructors' },
    { href: '/features/ai-receptionist', label: 'AI Receptionist' },
    { href: '/pricing',                label: 'Pricing' },
  ],
  instructor: [
    { href: '/features/ai-receptionist', label: 'AI Receptionist' },
    { href: '/features/online-booking',  label: 'Online Booking' },
    { href: '/features/payments',        label: 'Payments' },
    { href: '/pricing',                  label: 'Pricing' },
  ],
  student: [
    { href: '/driving-lessons',        label: 'Find Instructors' },
    { href: '/pda-guide',              label: 'PDA Guide' },
    { href: '/learn-to-drive',         label: 'Learn to Drive' },
  ],
}

export default function PublicLayout({
  children,
  navVariant = 'default',
  hideFooter = false,
  className,
}: PublicLayoutProps) {
  const links = NAV_LINKS[navVariant]

  return (
    /* class="light" activates the .light CSS token block from globals.css */
    <div className={cn('light min-h-screen bg-background text-foreground', className)}>

      {/* ── Sticky nav ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="no-underline shrink-0 flex items-center gap-2.5 group">
            <Logo size={32} />
            <span className="text-base font-bold text-foreground hidden sm:block">
              DriveBook
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} className="nav-link text-sm">
                {label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="hidden sm:inline-flex nav-link text-sm"
            >
              Log in
            </Link>

            {navVariant === 'instructor' ? (
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-600/20 no-underline whitespace-nowrap"
              >
                <span className="sm:hidden">Free Trial</span>
                <span className="hidden sm:inline">Start Free Trial</span>
              </Link>
            ) : (
              <Link
                href="/book"
                className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm shadow-primary/20 no-underline whitespace-nowrap"
              >
                <span className="sm:hidden">Book</span>
                <span className="hidden sm:inline">Book a Lesson</span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main>{children}</main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      {!hideFooter && (
        <footer className="bg-card border-t border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">

              {/* Brand */}
              <div className="lg:col-span-1">
                <Link href="/" className="no-underline flex items-center gap-2 mb-3">
                  <Logo size={28} />
                  <span className="text-base font-bold text-foreground">DriveBook</span>
                </Link>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Australia&apos;s smart booking platform for driving instructors and learner drivers.
                </p>
              </div>

              {/* Instructors */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  For Instructors
                </p>
                <ul className="space-y-2">
                  {[
                    { href: '/teach-with-drivebook',     label: 'Why DriveBook' },
                    { href: '/features/ai-receptionist', label: 'AI Receptionist' },
                    { href: '/features/online-booking',  label: 'Online Booking' },
                    { href: '/features/payments',        label: 'Payments' },
                    { href: '/register',                 label: 'Start Free Trial' },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Students */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  For Students
                </p>
                <ul className="space-y-2">
                  {[
                    { href: '/driving-lessons',   label: 'Find an Instructor' },
                    { href: '/learn-to-drive',    label: 'Learn to Drive' },
                    { href: '/pda-guide',         label: 'PDA Test Guide' },
                    { href: '/book',              label: 'Book a Lesson' },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Company
                </p>
                <ul className="space-y-2">
                  {[
                    { href: '/about',    label: 'About' },
                    { href: '/blog',     label: 'Blog' },
                    { href: '/contact',  label: 'Contact' },
                    { href: '/privacy',  label: 'Privacy Policy' },
                    { href: '/terms',    label: 'Terms of Service' },
                  ].map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} DriveBook. All rights reserved.
              </p>
              <p className="text-xs text-muted-foreground">
                Built in Australia 🇦🇺
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
