import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-16 px-5 text-center">
        <h1 className="text-5xl font-bold mb-4">Your Driving Licence Journey Made Simple</h1>
        <p className="text-2xl mb-6 opacity-95">Connect with qualified instructors near you. Book lessons instantly. Pass your test with confidence.</p>
        <ul className="list-none p-0 my-6 text-left inline-block max-w-2xl text-lg">
          <li className="my-2">🎯 Smart booking with real-time availability—no waiting, no phone tag</li>
          <li className="my-2">📍 Location-based matching to find instructors who service your area</li>
          <li className="my-2">💰 Save up to 12% with bulk hour packages and test preparation bundles</li>
          <li className="my-2">📱 Manage everything 24/7 from your personal dashboard</li>
          <li className="my-2">🤖 AI voice receptionist available to help you book or reschedule anytime</li>
        </ul>
        <div className="mt-8 space-x-2">
          <Link href="/book" className="inline-block bg-white text-purple-600 px-7 py-4 rounded-lg no-underline font-semibold hover:-translate-y-0.5 transition-transform">
            Find Instructors Near You
          </Link>
          <Link href="/register" className="inline-block bg-green-500 text-white px-7 py-4 rounded-lg no-underline font-semibold hover:-translate-y-0.5 transition-transform">
            Join as an Instructor
          </Link>
          <Link href="/register" className="inline-block bg-amber-500 text-white px-7 py-4 rounded-lg no-underline font-semibold hover:-translate-y-0.5 transition-transform">
            Start Free Trial
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5">
        {/* Why Choose DriveBook */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-6 text-gray-800">Why Choose DriveBook?</h2>
          <div className="grid md:grid-cols-2 gap-10">
            <div id="learners">
              <h3 className="text-2xl mb-3 text-gray-700">For Learners</h3>
              <ul className="list-none p-0 space-y-4">
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Verified Instructors</strong>: Every instructor is background-checked, qualified, and reviewed by real students
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Book in Seconds</strong>: See real-time availability and reserve your lesson instantly—no phone calls, no waiting
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Flexible Packages</strong>: Pay-as-you-go or save with bulk packages. Cancel or reschedule easily
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Smart Reminders</strong>: Get SMS notifications before your lesson so you never miss a session
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>AI Support</strong>: Call our voice receptionist 24/7 to book, reschedule, or ask questions
                </li>
              </ul>
            </div>
            <div id="instructors">
              <h3 className="text-2xl mb-3 text-gray-700">For Instructors</h3>
              <ul className="list-none p-0 space-y-4">
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Grow Your Business</strong>: Get discovered by learners in your area searching for lessons right now
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Save Time</strong>: Automated booking system handles scheduling, payments, and reminders for you
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Get Paid Faster</strong>: Transparent pricing with weekly payouts directly to your account
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Reduce No-Shows</strong>: Automated SMS reminders mean students show up prepared
                </li>
                <li className="pl-7 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500 before:font-bold before:text-xl">
                  <strong>Professional Tools</strong>: Manage your calendar, track earnings, and view student notes all in one place
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-amber-50 p-8 rounded-xl border-l-4 border-amber-500 my-16">
          <h2 className="text-3xl mb-4">How it works — 3 simple steps</h2>
          <ol className="text-lg my-4 space-y-3">
            <li>Search or enter your postcode</li>
            <li>Choose an instructor and a timeslot</li>
            <li>Book and pay securely—get confirmation by SMS</li>
          </ol>
        </section>

        {/* What You Get */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-6 text-gray-800">What You Get</h2>
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <h3 className="text-2xl mb-4 text-gray-700">Learners</h3>
              <div className="grid gap-5">
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">💳 Flexible Payment</h3>
                  <p>Pay per lesson or save with 5, 10, or 20-hour packages</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">📝 Test Preparation</h3>
                  <p>Book mock tests and test-day packages to boost your confidence</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">📊 Progress Tracking</h3>
                  <p>View lesson notes and track your improvement over time</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">✅ Instant Confirmation</h3>
                  <p>Get booking confirmation via SMS immediately</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl mb-4 text-gray-700">Instructors</h3>
              <div className="grid gap-5">
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">💼 Zero Setup Fees</h3>
                  <p>Start with a free trial—no credit card required</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">📈 More Students</h3>
                  <p>Appear in local searches when learners are actively looking</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">⚡ Automated Admin</h3>
                  <p>Stop chasing payments and managing spreadsheets</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl">
                  <h3 className="text-xl mb-2">💰 Weekly Payouts</h3>
                  <p>Get paid every week with transparent fee structure</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-6 text-gray-800">What Our Community Says</h2>
          <blockquote className="border-l-4 border-purple-600 my-6 p-6 bg-gray-50 italic text-gray-700">
            <span className="text-5xl text-purple-600 leading-none">&ldquo;</span>
            I passed my test on the first try! DriveBook matched me with an instructor who understood exactly what I needed. The booking system made everything so easy. <strong>— Sarah M., Perth</strong>
          </blockquote>
          <blockquote className="border-l-4 border-purple-600 my-6 p-6 bg-gray-50 italic text-gray-700">
            <span className="text-5xl text-purple-600 leading-none">&ldquo;</span>
            Since joining DriveBook, my bookings have doubled. The AI receptionist handles calls while I'm teaching, and I get paid on time every week. Game changer! <strong>— James T., Driving Instructor</strong>
          </blockquote>
          <blockquote className="border-l-4 border-purple-600 my-6 p-6 bg-gray-50 italic text-gray-700">
            <span className="text-5xl text-purple-600 leading-none">&ldquo;</span>
            The bulk package saved me money and the SMS reminders kept me on track. Highly recommend! <strong>— Michael K., New Driver</strong>
          </blockquote>
        </section>

        {/* FAQ */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-6 text-gray-800">Frequently Asked Questions</h2>
          
          <h3 className="text-2xl mb-4 text-gray-700">For Learners</h3>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: How do I know an instructor is qualified?</strong></p>
            <p>A: All instructors must provide valid credentials and undergo background checks. You can also read reviews from real students before booking.</p>
          </div>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: Can I cancel or reschedule my lesson?</strong></p>
            <p>A: Yes! You can cancel or reschedule through your dashboard. Each instructor&apos;s cancellation policy is clearly shown on their profile.</p>
          </div>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: What payment methods do you accept?</strong></p>
            <p>A: We accept all major credit/debit cards and process payments securely through Stripe.</p>
          </div>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: How do bulk packages work?</strong></p>
            <p>A: Purchase 5, 10, or 20-hour packages at a discounted rate. Hours are added to your account and you can book lessons as needed.</p>
          </div>

          <h3 className="text-2xl mb-4 mt-10 text-gray-700">For Instructors</h3>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: How much does it cost to join?</strong></p>
            <p>A: Start with a free trial. After that, we charge a small platform fee per completed lesson—no monthly fees or hidden costs.</p>
          </div>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: How do I get paid?</strong></p>
            <p>A: Payments are processed weekly via direct deposit. You can track all earnings in your instructor dashboard.</p>
          </div>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: Can I set my own availability?</strong></p>
            <p>A: Absolutely! You control your schedule completely. Set your working hours, block off time, and update availability in real-time.</p>
          </div>
          <div className="bg-white border border-gray-200 p-5 rounded-lg my-4">
            <p className="mb-2"><strong className="text-purple-600">Q: What if a student doesn&apos;t show up?</strong></p>
            <p>A: Our automated SMS reminders reduce no-shows significantly. You can also set your own cancellation policy.</p>
          </div>
        </section>

        {/* CTA */}
        <section id="trial" className="bg-purple-600 text-white p-12 rounded-2xl text-center my-16">
          <h2 className="text-4xl mb-4 mt-0">Ready to get started?</h2>
          <p className="text-xl mb-8"><strong>For Learners:</strong> Find an instructor near you and book your first lesson today.</p>
          <p className="text-xl mb-8"><strong>For Instructors:</strong> Join DriveBook and start growing your business with zero setup fees.</p>
          <Link href="/register" className="inline-block bg-white text-purple-600 px-7 py-4 rounded-lg no-underline font-semibold hover:-translate-y-0.5 transition-transform">
            Get Started Now
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-10 px-5 text-center mt-16">
        <p>DriveBook - Connecting learners with professional driving instructors</p>
        <p className="mt-4 text-sm">Last updated: Feb 28, 2026</p>
      </footer>
    </div>
  )
}
