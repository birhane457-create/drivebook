"use client";

import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import {
  Search,
  ClipboardList,
  Target,
  MapPin,
  FileCheck,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Car,
  Clock,
  ChevronRight,
  Lightbulb,
  TrendingUp,
  Shield,
  CheckCircle,
  XCircle,
} from "lucide-react";

const prepSteps = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Assessment Lesson",
    desc: "Your instructor drives with you and maps your current ability against the 7 PDA competency areas. You'll know exactly what needs work before anything else.",
    color: "from-cyan-400 to-blue-500",
    shadow: "shadow-cyan-500/25",
  },
  {
    number: "02",
    icon: Target,
    title: "Targeted Practice",
    desc: "Rather than just logging hours, each lesson focuses on the specific competencies where you're weakest — observation, give way rules, speed management, and manoeuvres.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
  },
  {
    number: "03",
    icon: MapPin,
    title: "Local Route Familiarisation",
    desc: "Your instructor practises the roads around your test centre with you. Knowing the local intersections, roundabouts, and speed limits removes a layer of uncertainty on test day.",
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/25",
  },
  {
    number: "04",
    icon: FileCheck,
    title: "Mock Test",
    desc: "A full simulated PDA run under realistic test conditions. Your instructor scores you the same way an examiner would, so you know exactly where you stand before the real thing.",
    color: "from-emerald-400 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
  {
    number: "05",
    icon: MessageCircle,
    title: "Test-Day Debrief",
    desc: "Your instructor walks you through what to expect on the day — the vehicle check, examiner interaction, what to do if you make a mistake, and how to manage nerves.",
    color: "from-pink-500 to-rose-500",
    shadow: "shadow-pink-500/25",
  },
];

const readinessSignals = [
  {
    icon: TrendingUp,
    text: "Consistent performance across multiple lessons without significant errors",
    color: "text-emerald-600",
    bg: "bg-emerald-50/50 border-emerald-500/20",
  },
  {
    icon: MapPin,
    text: "Calm and in control on unfamiliar roads and new intersections",
    color: "text-blue-600",
    bg: "bg-blue-50/50 border-blue-500/20",
  },
  {
    icon: CheckCircle2,
    text: "Handling all 7 PDA competency areas without reminders from your instructor",
    color: "text-violet-600",
    bg: "bg-violet-50/50 border-violet-500/20",
  },
  {
    icon: Shield,
    text: "Passing mock tests consistently — not just once, but reliably",
    color: "text-amber-600",
    bg: "bg-amber-50/50 border-amber-500/20",
  },
];

const faqs = [
  {
    q: "How many lessons do I need before I'm test-ready?",
    a: "Most learners need between 15 and 25 hours of professional lessons before attempting the PDA — on top of their logbook supervised driving. It varies depending on how quickly you develop and how consistent your practice has been. Your instructor will give you an honest assessment.",
  },
  {
    q: "What is the WA PDA driving test?",
    a: "The Practical Driving Assessment is the on-road driving test required to get your provisional licence in Western Australia. It runs for approximately 30–45 minutes and covers competency areas including observation, speed management, intersections, and manoeuvres.",
  },
  {
    q: "Can my instructor provide the car for the test?",
    a: "Yes. Most instructors offer a test-day package that includes a pre-test warm-up lesson and the use of their vehicle for the assessment itself. This removes the stress of presenting your own car for the roadworthiness check.",
  },
  {
    q: "What happens if I fail the PDA?",
    a: "You'll receive a written report from the examiner detailing the specific faults recorded. Your instructor will go through the report with you, focus the next lessons on those areas, and help you decide when you're ready to rebook. There's no limit on attempts.",
  },
  {
    q: "Are mock tests worth doing?",
    a: "Absolutely. A mock test tells you and your instructor exactly where you stand under simulated test pressure. It surfaces the gaps that regular lessons don't always expose and gives you confidence that your performance is consistent enough to pass.",
  },
];

const prerequisites = [
  { text: "Hold your learner permit for a minimum of 6 months" },
  { text: "Log at least 50 hours of supervised driving in your logbook" },
  { text: "Include at least 5 hours of genuine night driving in your logbook" },
  { text: "Pass the Hazard Perception Test (HPT)" },
  { text: "Be at least 17 years old on test day" },
];

const competencyAreas = [
  {
    cat: "General Driving",
    items: [
      "Road positioning and lane discipline",
      "Speed management (appropriate, consistent)",
      "Following distance",
      "Mirror and blind spot checks",
      "Traffic signals and signs",
      "Give way at intersections",
    ],
  },
  {
    cat: "Manoeuvres",
    items: [
      "Reverse parallel parking",
      "Three-point turn (turn in the road)",
      "Uphill and downhill starts",
      "Reversing (around a corner in some routes)",
      "Controlled stops",
    ],
  },
  {
    cat: "Observation",
    items: [
      "Regular mirror checks",
      "Blind spot checks on all moves",
      "Scanning at intersections",
      "Pedestrian awareness",
      "Cyclist awareness",
    ],
  },
  {
    cat: "Higher Speed",
    items: [
      "Freeway entry and merging",
      "Lane changes at speed",
      "Maintaining appropriate speed",
      "Exiting the freeway correctly",
    ],
  },
];

const topFailureCauses = [
  { n: "1", t: "Insufficient observation", d: "Not checking mirrors and blind spots before and during every manoeuvre." },
  { n: "2", t: "Give way errors", d: "Failing to give way correctly at intersections, roundabouts, or when turning right." },
  { n: "3", t: "Speed management", d: "Travelling significantly below the limit or inconsistent speed without cause." },
  { n: "4", t: "Parallel parking", d: "Hitting the kerb, ending too far from the kerb, or insufficient observation." },
  { n: "5", t: "Stop sign compliance", d: "Rolling through a stop sign without a complete stop at the line." },
  { n: "6", t: "Freeway merging", d: "Merging too slowly, not checking blind spots, or poor lane positioning." },
  { n: "7", t: "Test anxiety affecting control", d: "Hesitation and overcaution from nerves causing stalling, indecision, or slow reaction." },
  { n: "8", t: "Pedestrian awareness", d: "Not giving way to pedestrians when turning or at marked crossings." },
];

export default function TestPreparationPage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-violet-900 text-white py-16 md:py-24 px-4">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm text-white/90 mb-6 border border-white/10">
            <FileCheck className="h-4 w-4" />
            <span>WA Practical Driving Assessment</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight">
            Driving Test Preparation
          </h1>
          <p className="text-lg md:text-xl text-blue-100/90 mb-8 max-w-2xl mx-auto leading-relaxed">
            Your instructor knows the test routes, the examiner&apos;s expectations,
            and exactly what to practise. Here&apos;s how to use your lessons to pass
            first time.
          </p>

          <Link
            href="/instructors"
            className="inline-flex items-center gap-2 bg-white text-indigo-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-indigo-900/50 hover:scale-105 transition-all no-underline"
          >
            <Search className="h-5 w-5" />
            Find an Instructor Near You
          </Link>
        </div>
      </header>

      <main className="bg-background">

        {/* What the PDA involves */}
        <section className="py-16 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5">
              What the WA PDA Driving Test Involves
            </h2>
            <div className="prose-none space-y-4 text-muted-foreground text-base leading-relaxed mb-8">
              <p>
                The Practical Driving Assessment is the final on-road test that WA learner
                drivers must pass to progress to a provisional licence. It runs for approximately
                30–45 minutes and takes place on public roads around the test centre.
              </p>
              <p>
                An assessor from the Department of Transport sits in the passenger seat and
                observes your driving across competency areas — including observation,
                speed and space management, intersections, traffic controls, overtaking,
                pedestrians, and manoeuvres. Minor errors are recorded as fault marks; certain
                serious errors result in immediate failure.
              </p>
              <p>
                The most common reasons learners fail are insufficient observation checks,
                give-way errors at intersections, and poor speed management — all things your
                instructor can specifically target in preparation lessons.
              </p>
            </div>
            <Link
              href="/pda-guide"
              className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 font-semibold text-sm no-underline transition-colors"
            >
              Read the complete PDA guide
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Prerequisites */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Before You Can Book the PDA
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              All five requirements must be met before the assessment can proceed. The assessor will verify documents before you drive.
            </p>

            {/* Quick-reference row */}
            <div className="flex flex-wrap gap-2 mb-8">
              {["6 months permit", "50 hrs logbook", "5 hrs night", "HPT cert", "17+ years"].map((item) => (
                <span key={item} className="bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                  {item}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              {prerequisites.map(({ text }) => (
                <div key={text} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.04] border border-border">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-foreground/80 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Competency Areas */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              What the PDA Tests — 4 Competency Areas
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              The assessor evaluates your performance across these specific areas during the on-road test.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {competencyAreas.map(({ cat, items }) => (
                <div key={cat} className="bg-white/[0.04] border border-border rounded-2xl p-5">
                  <h3 className="font-bold text-sm uppercase tracking-wide text-violet-400 mb-3">{cat}</h3>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-foreground/70">
                        <span className="text-violet-400 shrink-0 mt-0.5">·</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Top Failure Causes */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              The Most Common Failure Causes
            </h2>
            <p className="text-muted-foreground text-sm mb-8">
              Based on WA assessment patterns — address these specifically in your preparation.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {topFailureCauses.map(({ n, t, d }) => (
                <div key={n} className="flex gap-3 p-4 rounded-xl bg-white/[0.04] border border-border">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {n}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm mb-1">{t}</p>
                    <p className="text-foreground/55 text-xs leading-relaxed">{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link
                href="/blog/most-common-reasons-people-fail-the-pda-western-australia"
                className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 font-semibold text-sm no-underline transition-colors"
              >
                Read the full PDA failure analysis
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* How instructors prepare you */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                How Instructors Prepare You for the Test
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Good test preparation isn&apos;t just logging hours — it&apos;s structured practice
                with a clear goal at each stage.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prepSteps.map(({ number, icon: Icon, title, desc, color, shadow }) => (
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
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/30 no-underline"
              >
                Find a Preparation-Focused Instructor
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Mock test callout */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-violet-900/60 to-indigo-900/60 border border-violet-500/30 rounded-2xl p-8 md:p-10">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                    What Is a Mock Driving Test?
                  </h2>
                  <p className="text-foreground/60 text-sm">The most valuable lesson before your real PDA</p>
                </div>
              </div>

              <div className="space-y-3 text-foreground/75 text-sm leading-relaxed mb-8">
                <p>
                  A mock test is a full simulated PDA run by your instructor acting in the
                  assessor role. It runs for the same duration as the real test — approximately
                  30–45 minutes — on public roads, with your instructor recording fault marks
                  exactly as an examiner would.
                </p>
                <p>
                  The value is twofold: it tells you objectively whether your performance is
                  test-ready, and it replicates the pressure of being assessed — which affects
                  how most learners drive. Many students who perform well in regular lessons
                  discover their observation checks slip under test conditions. A mock catches that.
                </p>
                <p>
                  If you pass the mock comfortably, you&apos;re likely ready. If you accumulate
                  fault marks, your instructor can target exactly those areas before you book
                  the real thing — saving you a failed attempt and the delay that comes with it.
                </p>
              </div>

              <Link
                href="/instructors"
                className="inline-flex items-center gap-2 bg-white text-indigo-900 px-7 py-3.5 rounded-xl font-bold no-underline hover:scale-105 transition-all shadow-lg"
              >
                Book a Mock Test
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Test-day service */}
        <section className="py-14 md:py-20 px-4 bg-secondary/20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                The Test-Day Package
              </h2>
              <p className="text-muted-foreground">
                Many instructors offer a test-day service that covers everything from pickup
                to the assessment itself.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {[
                {
                  icon: Car,
                  title: "Instructor picks you up",
                  desc: "Arrive calm — your instructor collects you so you're not stressed before the test even starts.",
                  color: "text-cyan-600",
                  bg: "bg-cyan-50/50 border-cyan-500/20",
                },
                {
                  icon: Clock,
                  title: "Pre-test warm-up lesson",
                  desc: "Typically a 1-hour lesson immediately before the test to settle nerves and sharpen technique on familiar roads.",
                  color: "text-violet-600",
                  bg: "bg-violet-50/50 border-violet-500/20",
                },
                {
                  icon: MapPin,
                  title: "Drive to the test centre",
                  desc: "Your instructor drives you to the centre so you arrive ready rather than already fatigued from navigating there yourself.",
                  color: "text-emerald-600",
                  bg: "bg-emerald-50/50 border-emerald-500/20",
                },
                {
                  icon: FileCheck,
                  title: "Car hire for the test",
                  desc: "Use your instructor's vehicle for the PDA itself. No roadworthiness check stress, no unfamiliar hire car — just the car you've been training in.",
                  color: "text-amber-600",
                  bg: "bg-amber-50/50 border-amber-500/20",
                },
              ].map(({ icon: Icon, title, desc, color, bg }) => (
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

            <p className="text-sm text-muted-foreground text-center">
              Test-day packages vary by instructor — check their profile for details.{" "}
              <Link href="/pda-guide" className="text-violet-600 hover:text-violet-700 font-semibold no-underline">
                Find WA test centre locations in the PDA guide →
              </Link>
            </p>
          </div>
        </section>

        {/* When are you test-ready? */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                When Are You Actually Test-Ready?
              </h2>
              <p className="text-muted-foreground text-lg">
                Honest guidance — because rushing costs time and money.
              </p>
            </div>

            <div className="bg-amber-50/30 border border-amber-500/20 rounded-2xl p-6 mb-8 flex gap-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm mb-1">
                  Most learners need 15–25 hours of professional lessons
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  That&apos;s on top of your 50-hour logbook requirement. The logbook hours are
                  essential, but supervised practice with a parent is different from structured
                  professional instruction. The range varies — some learners are ready sooner,
                  others need more time. Don&apos;t compare yourself to others.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <p className="font-semibold text-foreground text-sm uppercase tracking-wide text-violet-600 mb-4">
                Signs you&apos;re ready for the test
              </p>
              {readinessSignals.map(({ icon: Icon, text, color, bg }) => (
                <div
                  key={text}
                  className={`flex gap-4 p-4 rounded-xl border ${bg}`}
                >
                  <Icon className={`h-5 w-5 ${color} flex-shrink-0 mt-0.5`} />
                  <p className="text-foreground/80 text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <div className="bg-secondary/50 border border-border rounded-xl p-5">
              <p className="text-foreground text-sm leading-relaxed">
                <span className="font-semibold">Ask your instructor directly.</span>{" "}
                A good instructor will give you an honest answer — not just book more lessons.
                If they say you&apos;re not ready yet, take that seriously. A failed PDA attempt
                means at least a week&apos;s wait to rebook, the cost of the test fee again, and
                the time to work on whatever failed.
              </p>
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
                    <ChevronRight className="h-4 w-4 text-violet-500 flex-shrink-0 mt-0.5" />
                    {q}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed pl-6">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dual CTA */}
        <section className="py-14 md:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-indigo-900 via-blue-800 to-violet-900 rounded-2xl p-10 md:p-16 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-violet-500/20 rounded-full blur-3xl" />

              <div className="relative text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-3">
                  Start Preparing for Your PDA
                </h2>
                <p className="text-blue-100/80 mb-8 text-lg max-w-xl mx-auto">
                  Find a verified instructor near you, or read the complete PDA guide to
                  understand exactly what&apos;s tested on the day.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/instructors"
                    className="inline-flex items-center justify-center gap-2 bg-white text-indigo-900 px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:scale-105 transition-all no-underline"
                  >
                    <Search className="h-5 w-5" />
                    Find an Instructor
                  </Link>
                  <Link
                    href="/pda-guide"
                    className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all no-underline backdrop-blur-sm"
                  >
                    <FileCheck className="h-5 w-5" />
                    Read the PDA Guide
                  </Link>
                </div>
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
          <Link href="/lessons" className="hover:text-foreground transition-colors no-underline">Lessons</Link>
          <Link href="/pda-guide" className="hover:text-foreground transition-colors no-underline">PDA Guide</Link>
          <Link href="/learn-to-drive" className="hover:text-foreground transition-colors no-underline">Learn to Drive</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors no-underline">Terms</Link>
        </div>
        © {new Date().getFullYear()} DriveBook
      </footer>
    </div>
  );
}
