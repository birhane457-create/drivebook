"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Logo from "@/components/Logo";
import LocationSearchBooking from "@/components/LocationSearchBooking";
import {
  Phone,
  Star,
  Users,
  Calendar,
  Shield,
  TrendingUp,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
  Search,
  X,
} from "lucide-react";

const VOICE_NUMBER = "";

/* ---------- Inline AI Receptionist Showcase ---------- */
const aiSteps = [
  { icon: Phone, title: "Call Anytime", desc: "24/7 line — no app needed" },
  { icon: MessageSquare, title: "AI Converses", desc: "Asks your suburb & time" },
  { icon: CheckCircle2, title: "Instant Booking", desc: "Reserves your slot live" },
  { icon: Clock, title: "SMS Confirm", desc: "Sent to you & instructor" },
];

function AIReceptionistShowcase() {
  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="relative mx-auto">
          <div className="absolute -inset-4 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 rounded-[3rem] blur-2xl" />
          <div className="relative w-64 h-[480px] bg-gradient-to-b from-violet-900 to-indigo-900 rounded-[2.5rem] border-4 border-white/10 shadow-2xl p-4 mx-auto">
            <div className="w-24 h-5 bg-black/40 rounded-full mx-auto mb-4" />
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 h-[400px] flex flex-col">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">DriveBook AI</p>
                  <p className="text-cyan-300 text-[10px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online now
                  </p>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-2.5 py-3 overflow-hidden">
                <div className="self-start max-w-[80%] bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-white text-xs">Hi! What suburb are you in?</div>
                <div className="self-end max-w-[80%] bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl rounded-tr-sm px-3 py-2 text-white text-xs">I'm in Subiaco, WA</div>
                <div className="self-start max-w-[80%] bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-white text-xs">Great! I have Sarah available tomorrow at 10am. Shall I book it?</div>
                <div className="self-end max-w-[80%] bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl rounded-tr-sm px-3 py-2 text-white text-xs">Yes please!</div>
                <div className="self-start max-w-[80%] bg-emerald-500/20 border border-emerald-400/30 rounded-2xl rounded-tl-sm px-3 py-2 text-emerald-200 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> Booked! SMS sent ✅
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {aiSteps.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 hover:border-cyan-400/30 hover:shadow-lg transition-all">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span className="text-cyan-600 text-xs font-black">{String(i + 1).padStart(2, "0")}</span>
                  {title}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Data ---------- */
const heroFeatures = [
  "🎯 Smart booking with real-time availability",
  "📍 Location-based instructor matching",
  "💰 Save up to 12% with bulk packages",
  "📞 AI answers 24/7 — no app needed",
  "📱 Full dashboard access anytime",
  "📊 Track your progress lesson by lesson",
];

const whyChoose = [
  { icon: "✓", title: "Trusted & Approved", desc: "Background-checked, licensed, and reviewed by real students before they can take a booking.", gradient: "from-emerald-400 to-teal-500", hover: "hover:border-emerald-500/40 hover:shadow-emerald-500/10" },
  { icon: "⚡", title: "Book in Seconds", desc: "See real-time availability and reserve your lesson instantly—no phone calls, no waiting.", gradient: "from-yellow-400 to-orange-500", hover: "hover:border-yellow-500/40 hover:shadow-yellow-500/10" },
  { icon: "💰", title: "Flexible Packages", desc: "Pay-as-you-go or save up to 12% with bulk packages. Full refund with 48+ hours notice.", gradient: "from-cyan-400 to-blue-500", hover: "hover:border-cyan-500/40 hover:shadow-cyan-500/10" },
  { icon: "📱", title: "Smart Reminders", desc: "Get SMS notifications before your lesson so you never miss a session.", gradient: "from-pink-500 to-rose-500", hover: "hover:border-pink-500/40 hover:shadow-pink-500/10" },
  { icon: "📊", title: "Track Your Progress", desc: "View lesson notes and track your improvement over time. See what to work on.", gradient: "from-violet-500 to-purple-600", hover: "hover:border-violet-500/40 hover:shadow-violet-500/10" },
  { icon: "🎯", title: "Test Preparation", desc: "Book mock tests and test-day packages to boost your confidence.", gradient: "from-indigo-400 to-blue-600", hover: "hover:border-indigo-500/40 hover:shadow-indigo-500/10" },
];

const progressItems = [
  { label: "Signalling", score: 90, color: "bg-emerald-500" },
  { label: "Look Behind", score: 85, color: "bg-emerald-500" },
  { label: "Movement", score: 80, color: "bg-emerald-500" },
  { label: "Path Control", score: 88, color: "bg-emerald-500" },
  { label: "Vehicle Mgmt", score: 72, color: "bg-amber-500" },
  { label: "Responsiveness", score: 92, color: "bg-emerald-500" },
];

const howSteps = [
  { step: "1", title: "Search Your Area", desc: "Enter your suburb or postcode to find approved instructors near you.", color: "from-blue-500 to-blue-600" },
  { step: "2", title: "Choose & Book", desc: "View instructor profiles, ratings, and hourly rates. Select your package.", color: "from-violet-500 to-purple-600" },
  { step: "3", title: "Pay Securely", desc: "Pay by card or use your wallet balance. Get instant SMS confirmation.", color: "from-emerald-500 to-teal-500" },
  { step: "4", title: "Track Progress", desc: "After each lesson your instructor logs personalised feedback.", color: "from-amber-500 to-orange-500" },
];

const whatYouGet = [
  { title: "Flexible Payment", desc: "Pay per lesson or save with 5, 10, or 20-hour packages", icon: "💳", color: "from-purple-500/20 to-purple-600/10", border: "border-purple-500/30 hover:border-purple-400/50" },
  { title: "Test Preparation", desc: "Book mock tests and test-day packages to boost your confidence", icon: "📝", color: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/30 hover:border-blue-400/50" },
  { title: "Progress Tracking", desc: "View lesson notes and track your improvement over time", icon: "📊", color: "from-green-500/20 to-green-600/10", border: "border-green-500/30 hover:border-green-400/50" },
  { title: "Instant Confirmation", desc: "Get booking confirmation via SMS immediately", icon: "✅", color: "from-amber-500/20 to-amber-600/10", border: "border-amber-500/30 hover:border-amber-400/50" },
];

const faqs = [
  { q: "How do I know an instructor is qualified?", a: "All instructors must provide valid credentials and undergo background checks. You can also read reviews from real students before booking." },
  { q: "Can I cancel or reschedule my lesson?", a: "Yes. Cancel or reschedule through your dashboard anytime. Platform policy: full refund with 48+ hours notice, 50% refund for 24–48 hours, no refund under 24 hours." },
  { q: "What payment methods do you accept?", a: "We accept all major credit/debit cards and process payments securely through Stripe." },
  { q: "How do bulk packages work?", a: "Purchase 5, 10, or 20-hour packages at a discounted rate. Hours are added to your account and you can book lessons as needed." },
  { q: "Can I choose my own instructor?", a: "Absolutely! Browse instructor profiles, read reviews, check their availability, and choose the one that's right for you." },
];

const footerCols = [
  { title: "Company", links: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/teach-with-drivebook", label: "For Instructors" },
    { href: "/platform", label: "Platform Guide" },
  ]},
  { title: "Resources", links: [
    { href: "/learn-to-drive", label: "Learn to Drive" },
    { href: "/pda-guide", label: "WA PDA Guide" },
    { href: "/for-instructors", label: "Instructor Hub" },
    { href: "/blog", label: "Blog" },
  ]},
  { title: "Locations", links: [
    { href: "/driving-lessons", label: "All Locations" },
    { href: "/driving-lessons/western-australia", label: "Western Australia" },
    { href: "/driving-lessons/western-australia/perth", label: "Perth" },
    { href: "/driving-lessons/western-australia/maylands", label: "Maylands" },
    { href: "/driving-lessons/western-australia/joondalup", label: "Joondalup" },
    { href: "/driving-lessons/western-australia/fremantle", label: "Fremantle" },
  ]},
  { title: "Features", links: [
    { href: "/features/ai-receptionist", label: "AI Receptionist" },
    { href: "/features/online-booking", label: "Online Booking" },
    { href: "/features/custom-domain", label: "Custom Domain" },
    { href: "/features/payments", label: "Payments" },
    { href: "/features/student-progress", label: "Student Progress" },
    { href: "/features/multi-instructor", label: "Multi-Instructor" },
  ]},
  { title: "Legal", links: [
    { href: "/terms", label: "Learner Terms" },
    { href: "/instructor-terms", label: "Instructor Terms" },
    { href: "/privacy", label: "Privacy Policy" },
  ]},
  { title: "Get Started", links: [
    { href: "/book", label: "Find an Instructor" },
    { href: "/register", label: "Create Account" },
    { href: "/login", label: "Login" },
  ]},
];

/* ---------- Page ---------- */
export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="light min-h-screen bg-background text-foreground">
      {/* Navigation - Using new PublicNav component */}
      <PublicNav />      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-16 md:py-24 px-4">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Text Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm text-white/90 mb-6 border border-white/10">
                <Shield className="h-4 w-4" />
                <span>Australia's #1 Driving Lesson Platform</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                Pass Your Driving Test{" "}
                <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                  with Confidence
                </span>
              </h1>

              <p className="text-lg md:text-xl mb-6 text-purple-100/90">
                Book local instructors in seconds. Flexible lessons, transparent pricing, approved instructors.
              </p>

              <p className="text-sm text-purple-300/80 mb-6">
                Running a driving school?{" "}
                <Link href="/teach-with-drivebook" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 font-medium no-underline transition-colors">
                  AI Receptionist, Bookings &amp; Business Platform →
                </Link>
              </p>

              <div className="grid sm:grid-cols-2 gap-2.5 text-left text-purple-100/90 text-sm mb-8">
                {heroFeatures.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-cyan-300">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Mobile: button opens search modal */}
              <div className="lg:hidden">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="inline-flex items-center gap-2 bg-white text-violet-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-purple-900/50 hover:scale-105 transition-all w-full justify-center"
                >
                  <Search className="h-5 w-5" />
                  Book Your First Lesson
                </button>
              </div>
            </div>

            {/* Right: Compact Search Form (Desktop Only) */}
            <div className="hidden lg:block">
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-purple-900/30 p-6 max-w-md ml-auto">
                <LocationSearchBooking />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="bg-background">
        {/* Audience fork */}
        <section className="max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Link href="/book" className="group relative rounded-2xl overflow-hidden border border-border hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/10 transition-all bg-gradient-to-br from-cyan-50/50 to-blue-50/50 no-underline p-8 md:p-10">
              <div className="flex flex-col items-start">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🎓</span>
                </span>
                <h2 className="text-xl font-bold mb-3 text-foreground">I want to learn to drive</h2>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">Find a verified local instructor, book instantly, track your progress.</p>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-cyan-600 group-hover:gap-3 transition-all">Find an instructor →</span>
              </div>
            </Link>

            <Link href="/teach-with-drivebook" className="group relative rounded-2xl overflow-hidden border border-border hover:border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all bg-gradient-to-br from-purple-50/50 to-pink-50/50 no-underline p-8 md:p-10">
              <div className="flex flex-col items-start">
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🚗</span>
                </span>
                <h2 className="text-xl font-bold mb-3 text-foreground">I want to grow my driving school</h2>
                <p className="text-muted-foreground mb-6 text-sm leading-relaxed">Automate bookings, payments, and admin. AI receptionist included.</p>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-purple-600 group-hover:gap-3 transition-all">Learn more →</span>
              </div>
            </Link>
          </div>
        </section>

        {/* Trust Badge */}
        <section className="py-8 md:py-12 px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border border-emerald-500/30 rounded-2xl backdrop-blur-sm px-6 py-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-emerald-600">
              <Shield className="h-8 w-8" />
              <span className="text-2xl">🛡️</span>
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-foreground text-lg">Every instructor is background-checked, licensed &amp; approved</p>
              <p className="text-muted-foreground text-sm mt-1">Credentials verified by DriveBook before they can accept a single booking.</p>
            </div>
          </div>
        </section>

        {/* AI Voice Receptionist */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12 px-4">
            <div className="inline-flex items-center gap-2 bg-cyan-100/50 text-cyan-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Phone className="h-4 w-4" />
              AI-Powered
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Book by Phone —{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">AI Answers 24/7</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No app download required. Just call and book. Our AI receptionist handles availability, booking, and SMS confirmation — any time of day.
            </p>
          </div>
          <AIReceptionistShowcase />
        </section>

        {/* Why Choose */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12 px-4">
            <div className="inline-flex items-center gap-2 bg-purple-100/50 text-purple-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Star className="h-4 w-4" />
              Why DriveBook
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Why Choose{" "}
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">DriveBook?</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
            {whyChoose.map(({ icon, title, desc, gradient, hover }) => (
              <div key={title} className={`group p-8 rounded-2xl bg-secondary/30 border border-border ${hover} backdrop-blur-sm transition-all`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg text-white text-xl font-bold`}>
                  {icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-foreground">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Progress Tracking */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12 px-4">
            <div className="inline-flex items-center gap-2 bg-amber-100/50 text-amber-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <TrendingUp className="h-4 w-4" />
              Track Your Progress
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              See Your Improvement{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Lesson by Lesson</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              After every lesson, your instructor logs your performance directly into DriveBook — giving you personalised feedback on exactly what to work on next.
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-xl mx-auto">
              Scores are based on your instructor&apos;s observations and are a learning guide only. Always follow your instructor&apos;s advice on test readiness.
            </p>
          </div>
          <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-3 gap-4">
            {progressItems.map(({ label, score, color }) => (
              <div key={label} className="bg-secondary/30 border border-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-lg font-bold text-foreground">{score}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/book" className="inline-block bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-3 rounded-xl no-underline font-semibold hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/30">
              Find an Instructor →
            </Link>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12 px-4">
            <div className="inline-flex items-center gap-2 bg-blue-100/50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <Users className="h-4 w-4" />
              Simple Process
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-lg text-muted-foreground">From search to test-ready in 4 simple steps</p>
          </div>
          <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-2 gap-6">
            {howSteps.map(({ step, title, desc, color }) => (
              <div key={step} className="flex gap-4 p-6 rounded-2xl bg-secondary/30 border border-border hover:bg-secondary/50 transition-all">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-extrabold text-lg shrink-0`}>
                  {step}
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/book" className="inline-block bg-gradient-to-r from-blue-600 to-violet-600 text-white px-10 py-4 rounded-xl no-underline font-bold text-lg hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/30">
              Find an Instructor Near You →
            </Link>
          </div>
        </section>

        {/* What You Get */}
        <section className="py-12 md:py-20">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-foreground mb-12 px-4">What You Get</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto px-4">
            {whatYouGet.map(({ title, desc, icon, color, border }) => (
              <div key={title} className={`bg-gradient-to-br ${color} ${border} p-6 rounded-xl backdrop-blur-sm transition-all`}>
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 md:py-20">
          <div className="text-center mb-12 px-4">
            <div className="inline-flex items-center gap-2 bg-violet-100/50 text-violet-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
              <HelpCircle className="h-4 w-4" />
              Frequently Asked Questions
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">Got Questions?</h2>
          </div>
          <div className="max-w-3xl mx-auto px-4 space-y-4">
            {faqs.map(({ q, a }, i) => (
              <div key={i} className="bg-secondary/30 border border-border p-6 rounded-lg hover:bg-secondary/50 transition-all">
                <p className="mb-2 font-semibold text-foreground">{q}</p>
                <p className="text-muted-foreground text-sm">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-4 my-12 md:my-20">
          <div className="relative bg-gradient-to-r from-violet-900 via-purple-800 to-indigo-900 text-white p-8 md:p-16 rounded-2xl text-center shadow-2xl shadow-purple-900/50 overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
            <div className="relative max-w-3xl mx-auto">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Start Your Driving Journey?</h2>
              <p className="text-xl text-purple-100/80 mb-8">Book your first lesson today and pass your test with confidence.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/book" className="inline-flex items-center gap-2 bg-white text-violet-900 px-8 py-4 rounded-xl no-underline font-bold text-lg shadow-xl shadow-purple-900/50 hover:shadow-purple-500/50 hover:scale-105 transition-all">
                  <Calendar className="h-5 w-5" />
                  Find Your Instructor
                </Link>
                {VOICE_NUMBER && (
                  <a href={`tel:${VOICE_NUMBER}`} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-xl no-underline font-bold text-lg border-2 border-white/20 hover:bg-white/20 transition-all">
                    <Phone className="h-5 w-5" />
                    Call {VOICE_NUMBER}
                  </a>
                )}
              </div>
              <p className="mt-6 text-purple-200/80 text-sm">
                Are you a driving instructor?{" "}
                <Link href="/teach-with-drivebook" className="text-white underline font-semibold hover:text-purple-100 transition-colors no-underline">
                  Learn how DriveBook can grow your business →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card/50 backdrop-blur border-t border-border text-foreground py-12 px-4 md:px-8 mt-16">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 lg:grid-cols-7 gap-8 mb-8 text-left">
          <div>
            <Logo size={28} dark />
            <p className="text-muted-foreground text-sm mt-3">Connecting learners with professional driving instructors across Australia.</p>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <h3 className="font-semibold mb-3 text-foreground text-sm">{col.title}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-foreground transition-colors no-underline">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} DriveBook. All rights reserved. ·{" "}
          <Link href="/terms" className="hover:text-foreground transition-colors no-underline">Learner Terms</Link> ·{" "}
          <Link href="/instructor-terms" className="hover:text-foreground transition-colors no-underline">Instructor Terms</Link> ·{" "}
          <Link href="/privacy" className="hover:text-foreground transition-colors no-underline">Privacy</Link>
        </div>
      </footer>

      {/* Mobile search modal */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-start justify-center p-4 pt-20" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setSearchOpen(false)} className="text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
                <X className="h-6 w-6" />
              </button>
            </div>
            <LocationSearchBooking />
          </div>
        </div>
      )}
    </div>
  );
}
