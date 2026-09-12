"use client";

import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import {
  Search,
  Star,
  Package,
  Calendar,
  UserCheck,
  CreditCard,
  CheckCircle2,
  Clock,
  Shield,
  Phone,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

/**
 * /book — How Booking Works
 * Explains the booking process before sending users to /instructors search.
 * 
 * Booking flow after this page:
 *   /instructors → pick instructor
 *   /book/[instructorId]/package → choose package
 *   /book/[instructorId]/booking-details → pick date/time
 *   /book/[instructorId]/details → account details
 *   /book/[instructorId]/payment → pay
 *   /book/[instructorId]/confirmation → done
 */

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Search Your Area",
    desc: "Enter your suburb or postcode to see approved instructors near you. Filter by manual or automatic, language preference, and availability.",
    color: "from-cyan-400 to-blue-500",
    shadow: "shadow-cyan-500/25",
  },
  {
    number: "02",
    icon: Star,
    title: "Choose an Instructor",
    desc: "Browse profiles, read real student reviews, and check hourly rates. Every instructor is background-checked and licensed before listing.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
  },
  {
    number: "03",
    icon: Package,
    title: "Pick a Package",
    desc: "Book a single lesson or save up to 12% with 5, 10, or 20-hour packages. Package hours go into your wallet — use them anytime.",
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/25",
  },
  {
    number: "04",
    icon: Calendar,
    title: "Select Date & Time",
    desc: "See your instructor's real-time availability. Pick a slot that suits you — morning, afternoon, or evening.",
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
  {
    number: "05",
    icon: UserCheck,
    title: "Your Details",
    desc: "Create a free account or log in. We need your name, phone, and licence stage so your instructor arrives prepared.",
    color: "from-pink-500 to-rose-500",
    shadow: "shadow-pink-500/25",
  },
  {
    number: "06",
    icon: CreditCard,
    title: "Pay Securely",
    desc: "Pay by card via Stripe. Funds are held securely and released to the instructor only after your lesson is completed.",
    color: "from-indigo-400 to-blue-600",
    shadow: "shadow-indigo-500/25",
  },
];

const afterBooking = [
  {
    icon: CheckCircle2,
    title: "Instant SMS confirmation",
    desc: "Both you and your instructor get an SMS the moment your booking is confirmed.",
    color: "text-emerald-600",
    bg: "bg-emerald-50/50 border-emerald-500/20",
  },
  {
    icon: Clock,
    title: "24hr lesson reminder",
    desc: "We send a reminder the day before so you never miss a session.",
    color: "text-blue-600",
    bg: "bg-blue-50/50 border-blue-500/20",
  },
  {
    icon: Star,
    title: "Lesson feedback",
    desc: "After each lesson your instructor logs your progress. Track improvement across every session.",
    color: "text-amber-600",
    bg: "bg-amber-50/50 border-amber-500/20",
  },
  {
    icon: Calendar,
    title: "Easy rescheduling",
    desc: "Life happens. Cancel or reschedule from your dashboard. Platform policy: full refund 48+ hrs notice, 50% refund 24–48 hrs, no refund under 24 hrs.",
    color: "text-violet-600",
    bg: "bg-violet-50/50 border-violet-500/20",
  },
];

const faqs = [
  {
    q: "Do I need an account to book?",
    a: "Yes — you create a free account during the booking flow. It only takes a minute and lets you manage all your lessons in one place.",
  },
  {
    q: "What if I need to cancel?",
    a: "Cancel from your student dashboard. DriveBook's platform policy applies: cancel 48+ hours before your lesson for a full refund, 24–48 hours for a 50% refund, or under 24 hours for no refund. Refunds go back to your wallet.",
  },
  {
    q: "How do packages work?",
    a: "When you buy a package (5, 10, or 20 hours), the credit goes into your wallet. Book individual lessons and the hours are deducted automatically. No expiry — use them at your own pace.",
  },
  {
    q: "Can I switch instructors?",
    a: "Yes. Your wallet balance stays with you, so you can book with any instructor on the platform at any time.",
  },
  {
    q: "Is my payment safe?",
    a: "All payments go through Stripe. DriveBook never stores card details. Funds are held until your lesson is complete.",
  },
];

export default function HowBookingWorksPage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-16 md:py-20 px-4">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl translate-y-1/2" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm text-white/90 mb-6 border border-white/10">
            <Shield className="h-4 w-4" />
            <span>Trusted by learners across Australia</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            How Booking Works
          </h1>
          <p className="text-lg md:text-xl text-purple-100/90 mb-8 max-w-2xl mx-auto">
            From search to your first lesson — the whole process takes under 5 minutes. Here&apos;s exactly what happens.
          </p>

          <Link
            href="/instructors"
            className="inline-flex items-center gap-2 bg-white text-violet-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-purple-900/50 hover:scale-105 transition-all no-underline"
          >
            <Search className="h-5 w-5" />
            Find an Instructor Now
          </Link>
        </div>
      </header>

      <main className="bg-background">

        {/* Step-by-step */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                6 Steps to Your First Lesson
              </h2>
              <p className="text-muted-foreground text-lg">
                Simple, transparent, and fully online.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {steps.map(({ number, icon: Icon, title, desc, color, shadow }) => (
                <div
                  key={number}
                  className="group relative bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <span className="absolute top-4 right-5 text-5xl font-black text-secondary/60 select-none">
                    {number}
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

            <div className="text-center mt-12">
              <Link
                href="/instructors"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/30 no-underline"
              >
                Start Step 1 — Find an Instructor
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* After your booking */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                What Happens After You Book
              </h2>
              <p className="text-muted-foreground">
                We&apos;ve got everything handled so you can focus on learning.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {afterBooking.map(({ icon: Icon, title, desc, color, bg }) => (
                <div
                  key={title}
                  className={`flex gap-4 p-5 rounded-xl border ${bg} transition-all`}
                >
                  <Icon className={`h-6 w-6 ${color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1">{title}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Payments explained */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Flexible Payment Options
              </h2>
              <p className="text-muted-foreground">
                Pay per lesson or save with packages — no contracts, no pressure.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Single Lesson", desc: "Pay for one lesson at a time. Full flexibility.", badge: null, badgeColor: "" },
                { label: "5-Hour Package", desc: "Save up to 6% vs single lessons.", badge: "Popular", badgeColor: "bg-violet-100 text-violet-700" },
                { label: "10–20 Hour Package", desc: "Save up to 12% — best value for full learners.", badge: "Best Value", badgeColor: "bg-emerald-100 text-emerald-700" },
              ].map(({ label, desc, badge, badgeColor }) => (
                <div
                  key={label}
                  className="relative bg-card border border-border rounded-xl p-5 hover:border-violet-400/40 hover:shadow-md transition-all"
                >
                  {badge && (
                    <span className={`absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                      {badge}
                    </span>
                  )}
                  <p className="font-bold text-foreground mb-1">{label}</p>
                  <p className="text-muted-foreground text-sm">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-amber-50/50 border border-amber-500/20 rounded-xl p-4 flex gap-3">
              <CreditCard className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">Wallet system:</span> Package hours go into your wallet. Book individual lessons whenever you&apos;re ready — no expiry, and your balance works with any instructor on the platform.
              </p>
            </div>
          </div>
        </section>

        {/* Phone booking */}
        <section className="py-14 md:py-20 px-4 bg-gradient-to-br from-violet-900/5 to-indigo-900/5">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-cyan-100/50 text-cyan-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <Phone className="h-4 w-4" />
              Prefer the Phone?
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our AI Receptionist Handles It 24/7
            </h2>
            <p className="text-muted-foreground text-lg mb-4">
              Don&apos;t want to book online? Just call. Our AI answers any time, checks availability, and confirms your booking with an SMS — no app needed.
            </p>
            <p className="text-sm text-muted-foreground">
              Available around the clock — including weekends and public holidays.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Common Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map(({ q, a }) => (
                <div
                  key={q}
                  className="bg-card border border-border rounded-xl p-5 hover:bg-secondary/30 transition-all"
                >
                  <p className="font-semibold text-foreground mb-2 flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-violet-500 flex-shrink-0 mt-0.5" />
                    {q}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed pl-6">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-gradient-to-r from-violet-900 via-purple-800 to-indigo-900 rounded-2xl p-10 md:p-16 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-cyan-500/20 rounded-full blur-3xl" />

              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-3">
                  Ready to Book?
                </h2>
                <p className="text-purple-100/80 mb-8 text-lg">
                  Find a verified instructor in your area and book your first lesson today.
                </p>
                <Link
                  href="/instructors"
                  className="inline-flex items-center gap-2 bg-white text-violet-900 px-10 py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-105 transition-all no-underline"
                >
                  <Search className="h-5 w-5" />
                  Find an Instructor
                  <ArrowRight className="h-5 w-5" />
                </Link>

                <p className="mt-6 text-purple-200/70 text-sm">
                  Running a driving school?{" "}
                  <Link
                    href="/teach-with-drivebook"
                    className="text-white underline font-semibold hover:text-purple-100 transition-colors no-underline"
                  >
                    Explore DriveBook for instructors →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link href="/" className="hover:text-foreground transition-colors no-underline">Home</Link>
          <Link href="/instructors" className="hover:text-foreground transition-colors no-underline">Find an Instructor</Link>
          <Link href="/learn-to-drive" className="hover:text-foreground transition-colors no-underline">Learn to Drive</Link>
          <Link href="/register" className="hover:text-foreground transition-colors no-underline">Create Account</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors no-underline">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors no-underline">Privacy</Link>
        </div>
        © {new Date().getFullYear()} DriveBook
      </footer>
    </div>
  );
}
