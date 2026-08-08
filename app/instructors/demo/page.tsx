import type { Metadata } from 'next'
import Link from 'next/link'
import {
  MapPin, Car, Star, CheckCircle, ShieldCheck, Award,
  Clock, Phone, MessageCircle, Calendar,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Example Instructor Profile — DriveBook',
  description:
    'See how your instructor profile looks to students on DriveBook — photo, bio, rates, availability, packages, and reviews.',
  robots: 'noindex',
}

/**
 * Demo instructor profile — mirrors the real subdomain profile page.
 * All data is illustrative (based on real DriveBook profile structure).
 * No DB calls. Linked from onboarding emails.
 */
export default function DemoInstructorProfilePage() {
  const packages = [
    { hours: 6,  label: '6 hours',  discount: '5% bulk discount',  price: 428, badge: null },
    { hours: 10, label: '10 hours', discount: '10% bulk discount', price: 675, badge: 'Most popular' },
    { hours: 15, label: '15 hours', discount: '12% bulk discount', price: 990, badge: null },
  ]

  const teachingStyles = [
    'Nervous learners', 'First-timers', 'Intensive lessons',
    'Automatic specialist', 'Teenagers', 'Seniors',
    'International licence holders', 'Test prep focus',
  ]

  const availability = [
    { day: 'Mon', hours: '9am–5pm' },
    { day: 'Tue', hours: '9am–5pm' },
    { day: 'Wed', hours: '9am–5pm' },
    { day: 'Thu', hours: '9am–5pm' },
    { day: 'Fri', hours: '9am–5pm' },
    { day: 'Sat', hours: '9am–5pm' },
    { day: 'Sun', hours: '9am–5pm' },
  ]

  const nextAvailable = ['Today 3:00 pm', 'Today 4:00 pm', 'Tomorrow 9:00 am']

  const reviews = [
    { name: 'Emily R.', rating: 5, text: 'Sarah made me feel so comfortable — I passed first time! Very patient and clear explanations.', date: '2 weeks ago' },
    { name: 'James T.', rating: 5, text: 'Great lessons, highly recommend for anyone doing test prep. Very flexible with scheduling.', date: '1 month ago' },
    { name: 'Priya M.', rating: 5, text: 'Best driving instructor I\'ve had. Booked through DriveBook — super easy and no phone calls needed.', date: '6 weeks ago' },
  ]

  const faq = [
    { q: 'What should I bring to my lesson?', a: "Your learner's permit, comfortable closed-toe shoes, and glasses if you need them. That's it." },
    { q: 'Where will you pick me up?', a: 'You enter your pickup address during booking. Your instructor comes to you — home, work, or anywhere in the service area.' },
    { q: "What's the cancellation policy?", a: 'Full refund 48+ hours before. 50% refund for 24–48 hours notice. No refund under 24 hours.' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Demo banner */}
      <div className="bg-blue-600 text-white text-center py-2.5 px-4 text-sm font-medium">
        <span className="font-bold">Example profile</span>
        {' '}&#8212; This is a demonstration. Booking is not available from this page.&nbsp;
        <Link href="/register" className="underline hover:text-blue-100">
          Create your own profile →
        </Link>
      </div>

      {/* Nav */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-7 w-7 text-blue-500" />
            <span className="font-bold text-gray-900 text-lg">DriveBook</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#about" className="hover:text-blue-600">About</a>
            <a href="#services" className="hover:text-blue-600">Services</a>
            <a href="#availability" className="hover:text-blue-600">Availability</a>
            <a href="#contact" className="hover:text-blue-600">Contact</a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/61451916629"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
            <Link href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors no-underline">
              Create profile
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

            {/* Avatar */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center border-4 border-white shadow-xl">
                <span className="text-4xl font-bold text-white">D</span>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Name + meta */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                Sarah Mitchell
              </h1>
              <p className="text-gray-500 text-sm mb-2">AUTO driving lessons · 11+ yrs experience</p>

              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1.5 text-sm text-gray-500 mb-3">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> Maylands, Perth WA
                </span>
                <span className="flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-gray-400" /> Automatic
                </span>
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-gray-400" /> 11 years experience
                </span>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 mb-3">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-sm font-semibold text-gray-700 ml-1">4.9</span>
                  <span className="text-sm text-gray-400 ml-1">(47 reviews)</span>
                </div>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500 text-sm flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 312 lessons
                </span>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                {[
                  { icon: '🏆', label: '11+ Years Experience' },
                  { icon: '🔒', label: 'Secure Online Booking' },
                ].map(b => (
                  <span key={b.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
                    {b.icon} {b.label}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
                  <ShieldCheck className="w-3 h-3" /> Verified Instructor
                </span>
              </div>
            </div>

            {/* Rate + Next available */}
            <div className="text-center sm:text-right shrink-0">
              <p className="text-3xl font-bold text-gray-900">$75<span className="text-lg font-normal text-gray-400">/hr</span></p>
              <div className="mt-2 text-sm text-green-600 font-semibold flex items-center justify-center sm:justify-end gap-1">
                <Clock className="w-3.5 h-3.5" /> Next: Today 3:00 pm
              </div>
              <a href="#book"
                className="mt-3 inline-block bg-gray-100 text-gray-400 font-bold px-5 py-2.5 rounded-xl text-sm cursor-default">
                Example only
              </a>
            </div>
          </div>

          {/* How booking works strip */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-gray-500 border-t border-gray-100 pt-5">
            <div>
              <p className="text-lg mb-0.5">📦</p>
              <p className="font-semibold text-gray-700">Choose a package</p>
            </div>
            <div>
              <p className="text-lg mb-0.5">💳</p>
              <p className="font-semibold text-gray-700">Pay once upfront</p>
            </div>
            <div>
              <p className="text-lg mb-0.5">📅</p>
              <p className="font-semibold text-gray-700">Book your lessons</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Next available */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Next Available
            </h2>
            <div className="flex flex-wrap gap-2">
              {nextAvailable.map(slot => (
                <span key={slot}
                  className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-semibold rounded-lg border border-green-200">
                  {slot}
                </span>
              ))}
            </div>
          </div>

          {/* About */}
          <div id="about" className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Hi, I&rsquo;m Sarah Mitchell, your local driving instructor based in Maylands.
              With over 11 years of experience teaching automatic driving, I focus on creating
              a relaxed and supportive learning environment. I aim to build your confidence and
              skills behind the wheel while ensuring you understand road rules and safe driving practices.
              I conduct lessons in English and tailor my teaching style to suit your individual needs.
              Let&rsquo;s get you on the road — book a lesson today.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Sarah Mitchell is a verified DriveBook instructor based in Maylands, offering AUTO driving lessons.
              All lessons are booked and paid online — no phone calls or bank transfers required.
            </p>

            {/* Teaching style */}
            <h3 className="font-semibold text-gray-800 text-sm mt-5 mb-2">Teaching style</h3>
            <div className="flex flex-wrap gap-2">
              {teachingStyles.map(tag => (
                <span key={tag}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Services & Pricing */}
          <div id="services" className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Services &amp; Pricing</h2>

            {/* Single lesson */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl mb-4">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Single lesson</p>
                <p className="text-xs text-gray-400 mt-0.5">Available lesson lengths</p>
                <div className="flex gap-2 mt-1.5">
                  {[{ dur: '1 hr', price: '$75' }, { dur: '2 hrs', price: '$150' }].map(l => (
                    <span key={l.dur} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium">
                      {l.dur} &mdash; {l.price}
                    </span>
                  ))}
                </div>
              </div>
              <p className="font-bold text-gray-900 text-lg">$75/hr</p>
            </div>

            {/* Bulk packages */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Bulk lesson packages
            </p>
            <div className="space-y-3">
              {packages.map(pkg => (
                <div key={pkg.hours}
                  className={`flex items-center justify-between p-4 rounded-xl border
                    ${pkg.badge === 'Most popular'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{pkg.label}</p>
                      {pkg.badge && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                          {pkg.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-green-600 mt-0.5 font-medium">{pkg.discount}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${pkg.price}</p>
                    <button disabled className="mt-1 text-xs bg-gray-100 text-gray-400 px-3 py-1.5 rounded-lg font-semibold cursor-not-allowed">
                      Demo only
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/register"
              className="mt-4 block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors no-underline">
              Create my instructor profile →
            </Link>

            {/* Vehicle / languages / buffer */}
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
              <div>
                <p className="font-semibold text-gray-700 mb-0.5">Vehicle types</p>
                <p className="font-bold text-blue-600">AUTO</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-0.5">Languages</p>
                <p>English</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-0.5">Buffer</p>
                <p>15 min between lessons</p>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div id="availability" className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability</h2>
            <div className="space-y-2">
              {availability.map(a => (
                <div key={a.day} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 w-10">{a.day}</span>
                  <span className="text-gray-500">{a.hours}</span>
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full font-medium">Available</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Student Reviews</h2>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-gray-900">4.9</span>
                <span className="text-xs text-gray-400">(47)</span>
              </div>
            </div>
            <div className="space-y-4">
              {reviews.map((r, i) => (
                <div key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      {r.name[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{r.name}</span>
                    <div className="flex gap-0.5">
                      {[...Array(r.rating)].map((_, j) => (
                        <Star key={j} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 ml-auto">{r.date}</span>
                  </div>
                  <p className="text-sm text-gray-600">{r.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Before you book */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Before You Book</h2>
            <div className="space-y-3">
              {faq.map((item, i) => (
                <details key={i} className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-800 py-2 list-none">
                    {item.q}
                    <span className="text-gray-400 ml-2">+</span>
                  </summary>
                  <p className="text-sm text-gray-500 mt-1 pl-0 pb-2">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — sticky booking + contact */}
        <div className="space-y-4">

          {/* Book CTA — demo notice */}
          <div id="book" className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-20">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 uppercase tracking-wide">
                Example profile
              </span>
            </div>
            <p className="text-sm text-gray-700 font-semibold mb-1">Booking not available here</p>
            <p className="text-xs text-gray-400 mb-4">
              This is a demonstration profile. To receive real bookings, create your own instructor account.
            </p>

            {/* Next available — display only */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Next Available</p>
              <div className="space-y-1.5">
                {nextAvailable.map(slot => (
                  <div key={slot}
                    className="px-3 py-1.5 bg-white border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                    {slot}
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/register"
              className="block text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors no-underline">
              Create my instructor profile →
            </Link>
            <p className="text-xs text-gray-400 text-center mt-2">Free to register &middot; No credit card required</p>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              {['Instant booking confirmation', 'Secure online payment', 'Free cancellation 48h+ notice'].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div id="contact" className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Contact</h3>
            <div className="space-y-2.5">

              {/* Phone */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>0451 916 629</span>
              </div>

              {/* Vehicle */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Car className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>Toyota Yaris &middot; AUTO</span>
              </div>

              {/* WhatsApp */}
              <a
                href="https://wa.me/61451916629"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                WhatsApp
              </a>

              {/* Social links */}
              <div className="flex items-center gap-2 pt-1">
                {/* Instagram */}
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>

                {/* Facebook */}
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Facebook"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Service area */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Service Area</h3>
            <p className="text-xs text-gray-500">
              Maylands, Mt Lawley, Inglewood, Bayswater, Morley, Bedford,
              Noranda, Embleton, Rivervale
            </p>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-blue-700 text-white text-center py-10 px-4 mt-4">
        <p className="text-lg font-bold mb-1">Ready to create your own profile?</p>
        <p className="text-blue-200 text-sm mb-5">
          Join DriveBook and let students find, book, and pay you — all in one place.
        </p>
        <Link
          href="/register"
          className="inline-block bg-white text-blue-700 font-bold px-8 py-3 rounded-xl text-sm hover:bg-blue-50 transition-colors no-underline">
          Create my instructor profile →
        </Link>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        <div className="flex justify-center gap-4 mb-2">
          <a href="#about" className="hover:text-gray-600">About</a>
          <a href="#services" className="hover:text-gray-600">Services</a>
          <a href="#contact" className="hover:text-gray-600">Contact</a>
          <Link href="/register" className="hover:text-gray-600 no-underline">Create profile</Link>
        </div>
        <p>&copy; 2026 Sarah Mitchell &middot; Powered by DriveBook</p>
        <p className="mt-1 text-gray-300">This is an example profile for illustration purposes only.</p>
      </footer>
    </div>
  )
}
