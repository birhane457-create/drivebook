"use client";

import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import {
  Search,
  Wallet,
  Package,
  Clock,
  RefreshCw,
  Users,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";
import { PREDEFINED_PACKAGES } from '@/lib/config/packages';

/**
 * /lessons/packages â€” Driving Lesson Packages SEO landing page
 * Target keywords: "driving lesson packages", "bulk driving lessons",
 *                  "cheap driving lessons", "driving lesson deals"
 *
 * Explains the 5/10/20-hour bundle system and how the wallet works.
 * Primary CTA â†’ /instructors
 */

// Derived from PREDEFINED_PACKAGES â€” edit lib/config/packages.ts to change tiers
const packages = [
  // Single lesson is always first â€” not a package tier
  {
    label:      'Single Lesson',
    hours:      null as null,
    badge:      'Flexible',
    badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
    cardClass:  'bg-card border-border',
    rateNote:   'Full rate applies',
    saving:     null as null,
    savingColor: '',
    desc:       'Full flexibility, pay per lesson with no commitment. Book when you need it, cancel when you don\'t.',
    prominent:  false,
  },
  ...PREDEFINED_PACKAGES.map((pkg) => {
    const discountMap: Record<string, { pct: number; saving: string; rate: string }> = {
      PACKAGE_6:  { pct: 5,  saving: '~$24',  rate: '~$76/hr' },
      PACKAGE_10: { pct: 10, saving: '~$80',  rate: '~$72/hr' },
      PACKAGE_15: { pct: 12, saving: '~$144', rate: '~$70.40/hr' },
    };
    const d = discountMap[pkg.type];
    const badgeMap: Record<string, { color: string; cardClass: string; savingColor: string }> = {
      PACKAGE_6:  { color: 'bg-violet-100 text-violet-700 border-violet-200', cardClass: 'bg-card border-violet-400/30',                                                        savingColor: 'text-violet-600' },
      PACKAGE_10: { color: 'bg-sky-100 text-sky-700 border-sky-300',          cardClass: 'bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-400/50 shadow-lg shadow-sky-500/10', savingColor: 'text-sky-600'    },
      PACKAGE_15: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', cardClass: 'bg-card border-emerald-400/30',                                                     savingColor: 'text-emerald-600' },
    };
    const b = badgeMap[pkg.type];
    return {
      label:       `${pkg.hours}-Hour Package`,
      hours:       pkg.hours,
      badge:       pkg.featured ? 'â˜… Most Popular' : pkg.label,
      badgeColor:  b.color,
      cardClass:   b.cardClass,
      rateNote:    `Save ${d.pct}% vs single`,
      saving:      d.saving,
      savingColor: b.savingColor,
      desc:        pkg.type === 'PACKAGE_6'
        ? 'Perfect for beginners just starting out. Covers the basics and gets you comfortable behind the wheel.'
        : pkg.type === 'PACKAGE_10'
        ? 'Great for building skills over several weeks. Popular with learners heading toward their first test attempt.'
        : 'Ideal for full learners who need regular, ongoing lessons. Maximum savings and a solid runway to test day.',
      prominent: pkg.featured,
    };
  }),
];

const walletSteps = [
  {
    icon: Package,
    title: "Buy a package",
    desc: `Choose ${PREDEFINED_PACKAGES.map(p => p.hours).join(", ")} hours at checkout. The discounted hours are credited to your wallet instantly.`,
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
  {
    icon: Search,
    title: "Book a lesson",
    desc: "Pick any instructor, choose a date and time, and confirm. Hours are deducted from your wallet automatically.",
    color: "from-cyan-400 to-blue-500",
    shadow: "shadow-cyan-500/25",
  },
  {
    icon: Clock,
    title: "Valid 12 months",
    desc: "Use your hours over up to 12 months from purchase date. No rush.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
  },
  {
    icon: Users,
    title: "Any instructor",
    desc: "Your wallet balance works platform-wide. Switch instructors anytime without losing a single hour.",
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/25",
  },
];

// Savings table derived from PREDEFINED_PACKAGES
const savingsTable = [
  { pkg: 'Single lesson', hours: '1 hr', rate: '$80/hr', save: 'â€”', highlight: false },
  ...PREDEFINED_PACKAGES.map((pkg) => {
    const dataMap: Record<string, { rate: string; save: string }> = {
      PACKAGE_6:  { rate: '~$76/hr',    save: '~$24'  },
      PACKAGE_10: { rate: '~$72/hr',    save: '~$80'  },
      PACKAGE_15: { rate: '~$70.40/hr', save: '~$144' },
    };
    const d = dataMap[pkg.type];
    return {
      pkg:       `${pkg.label} (${pkg.hours} hrs)`,
      hours:     `${pkg.hours} hrs`,
      rate:      d.rate,
      save:      d.save,
      highlight: pkg.featured,
    };
  }),
];

const faqs = [
  {
    q: "Do packages expire?",
    a: "Package hours are valid for 12 months from the date of purchase. This gives you plenty of time to schedule lessons at your own pace.",
  },
  {
    q: "Can I use my package with a different instructor?",
    a: "Yes. Your wallet belongs to you, not to a specific instructor. You can book any instructor on the platform and the hours will be deducted from the same balance.",
  },
  {
    q: "What if I run out of hours mid-way through my learning?",
    a: "Easy â€” top up anytime from your dashboard. You can add any package to your existing wallet balance.",
  },
  {
    q: "Can I get a refund on unused hours?",
    a: "Yes. Contact our support team and we'll refund the unused portion of your wallet. Refunds are processed within 5 business days.",
  },
];

export default function LessonPackagesPage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-teal-700 to-cyan-800 text-white py-16 md:py-20 px-4">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl translate-y-1/2" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm text-white/90 mb-6 border border-white/10">
            <Sparkles className="h-4 w-4" />
            <span>Driving lesson packages â€” save up to 12%</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            Lesson Packages â€”{" "}
            <span className="text-cyan-300">Save Up to 12%</span>
          </h1>
          <p className="text-lg md:text-xl text-emerald-100/90 mb-8 max-w-2xl mx-auto">
            Pre-purchase hours at a discount â€” valid for 12 months. Book
            lessons whenever you&apos;re ready with any instructor on the platform.
          </p>

          <Link
            href="/instructors"
            className="inline-flex items-center gap-2 bg-white text-emerald-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-emerald-900/50 hover:scale-105 transition-all no-underline"
          >
            <Search className="h-5 w-5" />
            Find an Instructor &amp; Book
          </Link>
        </div>
      </header>

      <main className="bg-background">

        {/* Package cards */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Choose Your Package
              </h2>
              <p className="text-muted-foreground text-lg">
                The more you commit, the more you save â€” with no lock-in or expiry.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {packages.map(
                ({
                  label,
                  hours,
                  badge,
                  badgeColor,
                  cardClass,
                  rateNote,
                  saving,
                  savingColor,
                  desc,
                  prominent,
                }) => (
                  <div
                    key={label}
                    className={`relative rounded-2xl border p-6 flex flex-col transition-all hover:-translate-y-0.5 ${cardClass} ${
                      prominent ? "ring-2 ring-sky-500/40" : ""
                    }`}
                  >
                    {/* Badge */}
                    <span
                      className={`self-start text-xs font-bold px-2.5 py-1 rounded-full border mb-4 ${badgeColor}`}
                    >
                      {badge}
                    </span>

                    <h3 className="font-bold text-foreground text-xl mb-1">
                      {label}
                    </h3>

                    {saving ? (
                      <p className={`text-2xl font-black mb-1 ${savingColor}`}>
                        Save {saving}
                      </p>
                    ) : (
                      <p className="text-2xl font-black text-muted-foreground mb-1">
                        No discount
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground mb-4">
                      {rateNote}
                    </p>

                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {desc}
                    </p>

                    {prominent && (
                      <div className="mt-5">
                        <Link
                          href="/instructors"
                          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-cyan-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:from-sky-500 hover:to-cyan-500 transition-all no-underline"
                        >
                          Get Most Popular Package
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
              <Info className="h-4 w-4" />
              Exact rates vary by instructor. Savings shown are approximate based on a $80/hr single lesson rate.
            </p>
          </div>
        </section>

        {/* How the wallet works */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 bg-emerald-100/70 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Wallet className="h-4 w-4" />
                Your lesson wallet
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                How the Wallet Works
              </h2>
              <p className="text-muted-foreground text-lg">
                Simple, flexible, and always in your control.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {walletSteps.map(({ icon: Icon, title, desc, color, shadow }, i) => (
                <div
                  key={title}
                  className="relative bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <span className="absolute top-4 right-5 text-5xl font-black text-secondary/60 select-none">
                    0{i + 1}
                  </span>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg ${shadow} relative`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why packages make sense */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Why Packages Make Sense
              </h2>
              <p className="text-muted-foreground">
                Whether you&apos;re starting from scratch or topping up, there&apos;s a package for you.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Left */}
              <div className="bg-card border border-border rounded-2xl p-7">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25">
                  <RefreshCw className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-xl mb-3">
                  For learners starting from scratch
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Most new drivers need between 15 and 30 hours of professional
                  tuition before they&apos;re test-ready. That&apos;s a significant
                  outlay â€” packages let you spread the cost while locking in a
                  better rate from lesson one.
                </p>
                <ul className="space-y-2">
                  {[
                    "Lock in your rate from the start",
                    "No pressure to rush through lessons",
                    "Top up whenever you need more hours",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right */}
              <div className="bg-card border border-border rounded-2xl p-7">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/25">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-xl mb-3">
                  For learners who need top-ups
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Already have some experience but need more hours before your
                  test? Your wallet lets you add more hours at any time â€” no
                  need to start over or renegotiate a rate with your instructor.
                </p>
                <ul className="space-y-2">
                  {[
                    "Add hours to your existing balance",
                    "Works across all instructors",
                    "No contracts or minimum commitments",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Savings table */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Approximate Savings
              </h2>
              <p className="text-muted-foreground">
                Based on an example rate of $80/hr. Exact discounts set in admin pricing.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-4 bg-secondary/60 px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span>Package</span>
                <span className="text-center">Hours</span>
                <span className="text-center">Example rate</span>
                <span className="text-right">You save</span>
              </div>

              {/* Table rows */}
              {savingsTable.map(({ pkg, hours, rate, save, highlight }) => (
                <div
                  key={pkg}
                  className={`grid grid-cols-4 px-6 py-4 border-t border-border items-center transition-colors ${
                    highlight
                      ? "bg-sky-50/50 border-l-4 border-l-sky-500"
                      : "hover:bg-secondary/20"
                  }`}
                >
                  <span className={`font-semibold text-sm ${highlight ? "text-sky-700" : "text-foreground"}`}>
                    {pkg}
                    {highlight && (
                      <span className="ml-2 text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">
                        Popular
                      </span>
                    )}
                  </span>
                  <span className="text-center text-sm text-muted-foreground">{hours}</span>
                  <span className="text-center text-sm text-muted-foreground">{rate}</span>
                  <span className={`text-right text-sm font-bold ${highlight ? "text-sky-600" : save === "â€”" ? "text-muted-foreground" : "text-foreground"}`}>
                    {save}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
              <Info className="h-3.5 w-3.5" />
              Exact rates vary by instructor. Check each instructor&apos;s profile for their current pricing.
            </p>          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Package FAQs
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map(({ q, a }) => (
                <div
                  key={q}
                  className="bg-card border border-border rounded-xl p-5 hover:bg-secondary/30 transition-all"
                >
                  <p className="font-semibold text-foreground mb-2 flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {q}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed pl-6">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800 rounded-2xl p-10 md:p-16 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-400/20 rounded-full blur-3xl" />

              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-3">
                  Start with a Package and Save from Lesson One
                </h2>
                <p className="text-emerald-100/80 mb-8 text-lg">
                  Find a verified instructor near you, pick your package at
                  checkout, and book your first lesson in under 5 minutes.
                </p>
                <Link
                  href="/instructors"
                  className="inline-flex items-center gap-2 bg-white text-emerald-900 px-10 py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-105 transition-all no-underline"
                >
                  <Search className="h-5 w-5" />
                  Find an Instructor
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link href="/" className="hover:text-foreground transition-colors no-underline">Home</Link>
          <Link href="/instructors" className="hover:text-foreground transition-colors no-underline">Find an Instructor</Link>
          <Link href="/lessons" className="hover:text-foreground transition-colors no-underline">Lessons</Link>
          <Link href="/book" className="hover:text-foreground transition-colors no-underline">How Booking Works</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors no-underline">Pricing</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors no-underline">Terms</Link>
        </div>
        Â© {new Date().getFullYear()} DriveBook
      </footer>
    </div>
  );
}
