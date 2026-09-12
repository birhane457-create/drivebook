"use client";

import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import {
  MapPin,
  Shield,
  ClipboardList,
  BarChart2,
  Clock,
  Layers,
  Package,
  Search,
  Star,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  CreditCard,
  Car,
} from "lucide-react";
import { PREDEFINED_PACKAGES } from '@/lib/config/packages';

// ── What's included ────────────────────────────────────────────────────────────

const included = [
  {
    icon: MapPin,
    title: "Pick-up from your location",
    desc: "Your instructor comes to you — home, school, or work. No need to travel to a depot.",
    color: "from-cyan-400 to-blue-500",
    shadow: "shadow-cyan-500/25",
  },
  {
    icon: Shield,
    title: "Dual-control vehicle",
    desc: "Every lesson car has instructor brake and clutch controls fitted, so you're always safe.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
  },
  {
    icon: ClipboardList,
    title: "Personalised lesson plan",
    desc: "Your instructor tailors each session to where you're at — no two students follow the same path.",
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/25",
  },
  {
    icon: BarChart2,
    title: "Feedback logged after every lesson",
    desc: "Progress notes are added to your student dashboard after each session so you can track improvement over time.",
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
];

// ── Types of lessons ──────────────────────────────────────────────────────────

const lessonTypes = [
  {
    icon: Clock,
    title: "Single Lesson",
    badge: null,
    badgeColor: "",
    desc: "A 1-hour session, pay as you go. Perfect for trying an instructor, refreshing a specific skill, or fitting lessons around a busy schedule.",
    color: "from-cyan-400 to-blue-500",
  },
  {
    icon: Layers,
    title: "Custom Hours (1–50)",
    badge: null,
    badgeColor: "",
    desc: "Choose any number of hours from 1 to 50. Discounts kick in automatically at the 6, 10, and 15 hour thresholds — you only pay the discounted rate for the hours that qualify.",
    color: "from-violet-500 to-purple-600",
    link: "/lessons/packages",
  },
  {
    icon: Package,
    title: "Package Lessons",
    badge: "Best Value",
    badgeColor: "bg-emerald-100 text-emerald-700",
    desc: `Pre-purchase a ${PREDEFINED_PACKAGES.map(p => `${p.label} (${p.hours} hrs)`).join(', ')} package. Hours load into your wallet — book whenever it suits you, with any instructor.`,
    color: "from-emerald-400 to-teal-500",
    link: "/lessons/packages",
  },
];

// ── How to book ───────────────────────────────────────────────────────────────

const bookingSteps = [
  {
    num: "01",
    icon: Search,
    title: "Search your suburb",
    desc: "Enter your suburb or postcode on the instructor search page and filter by manual or automatic, language, and availability.",
    color: "from-cyan-400 to-blue-500",
    shadow: "shadow-cyan-500/25",
  },
  {
    num: "02",
    icon: Star,
    title: "Choose an instructor",
    desc: "Browse profiles, read real student reviews, and check the hourly rate. Every instructor is background-checked and licensed before listing.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
  },
  {
    num: "03",
    icon: Package,
    title: "Select your package",
    desc: `Pick a ${PREDEFINED_PACKAGES.map(p => `${p.label} (${p.hours} hrs)`).join(', ')}, or any custom amount from 1–50 hours. Discounts apply automatically at the relevant threshold.`,
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/25",
  },
  {
    num: "04",
    icon: Calendar,
    title: "Choose booking type",
    desc: "\"Book Now\" lets you schedule dates immediately. \"Book Later\" lets you pay now and schedule all your hours from your dashboard at your own pace.",
    color: "from-pink-500 to-rose-500",
    shadow: "shadow-pink-500/25",
  },
  {
    num: "05",
    icon: Clock,
    title: "Pick your date & time",
    desc: "If you chose Book Now, select from your instructor's real-time availability — morning, afternoon, or evening slots.",
    color: "from-indigo-400 to-blue-600",
    shadow: "shadow-indigo-500/25",
  },
  {
    num: "06",
    icon: ClipboardList,
    title: "Enter your details",
    desc: "Create an account or log in. Provide your name, phone number, and licence stage so your instructor can plan your first session.",
    color: "from-teal-400 to-emerald-500",
    shadow: "shadow-teal-500/25",
  },
  {
    num: "07",
    icon: CheckCircle2,
    title: "Pay securely via Stripe",
    desc: "Pay by card. You and your instructor both receive an instant SMS confirmation the moment your booking is complete.",
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: "How long is a driving lesson?",
    a: "Standard lessons are 1 hour. Many instructors also offer 90-minute or 2-hour sessions — check each instructor's profile for the options they provide.",
  },
  {
    q: "What do I need to bring?",
    a: "Bring your current learner licence (or provisional) and arrive on time. Your instructor will have everything else covered in the vehicle.",
  },
  {
    q: "Can I choose my instructor?",
    a: "Yes — you search and pick. Browse profiles, read reviews, check rates, and book directly with the instructor you want.",
  },
  {
    q: "What if I need to cancel?",
    a: "Cancel from your student dashboard. DriveBook's platform cancellation policy applies to all lessons: full refund if you cancel 48+ hours before the lesson, 50% refund for 24–48 hours notice, no refund under 24 hours. Refunds are credited to your wallet.",
  },
  {
    q: "How many lessons do I need?",
    a: "It depends on your starting experience and how often you practise between lessons. Your instructor will assess your progress and advise after your first session.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DrivingLessonsPage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-16 md:py-24 px-4">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl translate-y-1/2" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm text-white/90 mb-6 border border-white/10">
            <Car className="h-4 w-4" />
            <span>Verified instructors across Australia</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
            Driving Lessons —<br />
            <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">
              Find, Book &amp; Learn
            </span>
          </h1>
          <p className="text-lg md:text-xl text-purple-100/90 mb-8 max-w-2xl mx-auto leading-relaxed">
            Find a local, verified driving instructor, book online in minutes, and get a lesson plan tailored to exactly where you're at.
          </p>

          <Link
            href="/instructors"
            className="inline-flex items-center gap-2 bg-white text-violet-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-purple-900/50 hover:scale-105 transition-all no-underline"
          >
            <Search className="h-5 w-5" />
            Find an Instructor Near You
          </Link>
        </div>
      </header>

      <main className="bg-background">

        {/* What's included */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                What&apos;s Included in Every Lesson
              </h2>
              <p className="text-muted-foreground text-lg">
                Every booking on DriveBook comes with these as standard.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {included.map(({ icon: Icon, title, desc, color, shadow }) => (
                <div
                  key={title}
                  className="group bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg ${shadow}`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Types of lessons */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Types of Driving Lessons
              </h2>
              <p className="text-muted-foreground">
                Choose the format that fits your goals and schedule.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {lessonTypes.map(({ icon: Icon, title, badge, badgeColor, desc, color, link }) => (
                <div
                  key={title}
                  className="relative bg-card border border-border rounded-2xl p-6 hover:border-violet-400/40 hover:shadow-md transition-all flex flex-col"
                >
                  {badge && (
                    <span className={`absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                      {badge}
                    </span>
                  )}
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-md`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">{desc}</p>
                  {link && (
                    <Link
                      href={link}
                      className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-violet-500 hover:text-violet-400 transition-colors no-underline"
                    >
                      View packages <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How to book */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                How to Book a Lesson
              </h2>
              <p className="text-muted-foreground text-lg">
                The whole process takes under 5 minutes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {bookingSteps.map(({ num, icon: Icon, title, desc, color, shadow }) => (
                <div
                  key={num}
                  className="relative bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <span className="absolute top-4 right-5 text-5xl font-black text-secondary/60 select-none">
                    {num}
                  </span>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg ${shadow} relative`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Book Later note */}
            <div className="mt-8 flex items-start gap-3 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-400/20 rounded-xl p-4 max-w-2xl mx-auto">
              <Calendar className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">Book Later:</span> Pay now and schedule all your hours from your student dashboard at your own pace — no need to pick dates at checkout.
              </p>
            </div>

            <div className="text-center mt-10">
              <Link
                href="/instructors"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/30 no-underline"
              >
                Start Step 1 — Search Instructors
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Manual vs Automatic */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Manual or Automatic?
              </h2>
              <p className="text-muted-foreground">
                The vehicle type you learn in determines your licence conditions.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Manual */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-violet-400/30 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Car className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">Manual</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Full licence — covers both manual and automatic vehicles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>More to learn initially — clutch and gear changes add complexity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Broader employment and travel options — many work vehicles are manual</span>
                  </li>
                </ul>
              </div>

              {/* Automatic */}
              <div className="bg-card border border-border rounded-2xl p-6 hover:border-cyan-400/30 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-md">
                    <Car className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">Automatic</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                    <span>Easier to learn — no clutch means you focus on road awareness sooner</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                    <span>Licence is restricted to automatic vehicles only</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                    <span>Great option if most cars you&apos;ll drive are automatic</span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Not sure which to choose?{" "}
              <Link
                href="/blog/manual-vs-automatic-which-licence-should-you-choose"
                className="text-violet-500 hover:text-violet-400 font-semibold no-underline transition-colors"
              >
                Read our manual vs automatic guide →
              </Link>
            </p>
          </div>
        </section>

        {/* Pricing info */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                How Much Do Driving Lessons Cost?
              </h2>
              <p className="text-muted-foreground">
                Rates vary by location and instructor experience. Discounts apply automatically based on how many hours you purchase.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 text-center hover:border-violet-400/30 transition-all">
              <p className="text-5xl font-black text-violet-500 mb-2">$60–$100</p>
              <p className="text-muted-foreground text-lg mb-5">per hour, depending on location and instructor experience</p>
              <div className="flex flex-wrap justify-center gap-3 text-sm mb-6">
                {[
                  { label: `1–${PREDEFINED_PACKAGES[0].hours - 1} hrs`, sub: 'full rate' },
                  ...PREDEFINED_PACKAGES.map(p => ({
                    label: `${p.hours} hrs — ${p.label}`,
                    sub:   p.type === 'PACKAGE_6' ? '5% off' : p.type === 'PACKAGE_10' ? '10% off' : '12% off',
                  })),
                  { label: 'Custom 1–50 hrs', sub: 'discount at threshold' },
                ].map(({ label, sub }) => (
                  <div key={label} className="bg-secondary/60 border border-border rounded-xl px-4 py-2">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 bg-amber-50/50 border border-amber-500/20 rounded-xl p-4 text-left mb-4">
                <CreditCard className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Wallet system:</span> Buy a package and the hours load into your wallet. Book individual lessons whenever you&apos;re ready — no expiry, works with any instructor.
                </p>
              </div>
              <div className="flex items-start gap-3 bg-secondary/40 border border-border rounded-xl p-4 text-left mb-5">
                <CreditCard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Platform fee:</span> 3.6% applied at checkout. This covers secure payment processing, platform support, and SMS confirmations.
                </p>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 text-sm font-semibold text-violet-500 hover:text-violet-400 transition-colors no-underline"
              >
                See full pricing details <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
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
                    <ChevronRight className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
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
            <div className="bg-gradient-to-r from-violet-900 via-purple-800 to-indigo-900 rounded-2xl p-10 md:p-16 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-cyan-500/20 rounded-full blur-3xl" />

              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-3">
                  Ready for Your First Lesson?
                </h2>
                <p className="text-purple-100/80 mb-8 text-lg">
                  Find a verified instructor near you and book your first session today.
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
                  Want to understand the process first?{" "}
                  <Link
                    href="/book"
                    className="text-white font-semibold hover:text-purple-100 transition-colors no-underline underline"
                  >
                    See how booking works →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link href="/" className="hover:text-foreground transition-colors no-underline">Home</Link>
          <Link href="/instructors" className="hover:text-foreground transition-colors no-underline">Find an Instructor</Link>
          <Link href="/learn-to-drive" className="hover:text-foreground transition-colors no-underline">Learn to Drive</Link>
          <Link href="/book" className="hover:text-foreground transition-colors no-underline">How Booking Works</Link>
          <Link href="/register" className="hover:text-foreground transition-colors no-underline">Create Account</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors no-underline">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors no-underline">Privacy</Link>
        </div>
        © {new Date().getFullYear()} DriveBook
      </footer>
    </div>
  );
}
