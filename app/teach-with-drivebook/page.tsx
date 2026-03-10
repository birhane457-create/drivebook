import Link from 'next/link'

const VOICE_NUMBER = process.env.NEXT_PUBLIC_VOICE_PHONE_NUMBER

export default function TeachWithDriveBookPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white shadow-sm py-4 px-5">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-purple-600 no-underline">
            DriveBook
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              For Learners
            </Link>
            <Link href="/login" className="text-gray-700 hover:text-purple-600 no-underline font-medium">
              Login
            </Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-lg no-underline font-medium hover:bg-purple-700">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Instructor Focused */}
      <header className="bg-gradient-to-r from-green-600 to-green-800 text-white py-20 px-5 text-center">
        <h1 className="text-5xl font-bold mb-4">Grow Your Driving School Without the Admin Headaches</h1>
        <p className="text-2xl mb-6 opacity-95">Your free AI receptionist answers calls 24/7 while you teach. Never miss a booking again.</p>
        <ul className="list-none p-0 my-6 text-left inline-block max-w-2xl text-lg">
          <li className="my-2">💰 Zero setup fees - Start with a free trial</li>
          <li className="my-2">📞 AI receptionist handles calls while you&apos;re teaching</li>
          <li className="my-2">💳 Weekly payouts directly to your account</li>
          <li className="my-2">⚡ Automated booking, payments, and reminders</li>
          <li className="my-2">📈 Get discovered by learners actively searching</li>
        </ul>
        <div className="mt-8">
          <Link href="/register" className="inline-block bg-white text-green-600 px-10 py-5 rounded-lg no-underline font-bold text-xl hover:-translate-y-1 hover:shadow-2xl transition-all">
            Start Your Free Trial →
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5">
        {/* AI Receptionist - Instructor Angle */}
        <section className="my-16 -mt-10">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border-t-4 border-green-600">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-3">📞 Your Free 24/7 Virtual Receptionist</h2>
              <p className="text-xl text-gray-700">Never Miss Another Booking While You Teach</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-8 mb-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">Picture this scenario:</h3>
              <p className="text-lg text-gray-700 mb-4">
                You&apos;re helping a nervous student parallel park. Your phone rings - it&apos;s a parent ready to book a £1,000 package.
              </p>
              <p className="text-lg text-gray-700 mb-4">
                <strong className="text-red-600">With traditional driving schools:</strong> That call goes to voicemail. The parent hangs up and calls your competitor. <span className="text-red-600 font-semibold">Revenue lost forever.</span>
              </p>
              <p className="text-lg text-gray-700">
                <strong className="text-green-600">With DriveBook:</strong> Your AI receptionist answers professionally, checks your real-time availability, books the lesson instantly, and sends SMS confirmation to both parties. <span className="text-green-600 font-semibold">All while you stay focused on teaching.</span>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">What Your AI Receptionist Does:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                    <span className="text-gray-700"><strong>Answers calls professionally</strong> - Introduces your driving school by name</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                    <span className="text-gray-700"><strong>Checks real-time availability</strong> - Knows your exact schedule</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                    <span className="text-gray-700"><strong>Books lessons instantly</strong> - Secures the booking while they&apos;re on the phone</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                    <span className="text-gray-700"><strong>Sends SMS confirmations</strong> - To both you and the student</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                    <span className="text-gray-700"><strong>Handles rescheduling</strong> - Manages changes without interrupting you</span>
                  </li>
                </ul>
              </div>

              {VOICE_NUMBER ? (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-8 text-center border-2 border-green-300">
                  <p className="text-sm uppercase tracking-wide text-green-700 font-semibold mb-3">
                    Try it now - Call to experience it
                  </p>
                  <a
                    href={`tel:${VOICE_NUMBER}`}
                    className="inline-block bg-green-600 text-white px-8 py-5 rounded-xl no-underline font-bold text-3xl hover:bg-green-700 hover:scale-105 transition-all shadow-lg"
                  >
                    {VOICE_NUMBER}
                  </a>
                  <p className="text-sm text-gray-700 mt-4 font-semibold">
                    Available 24/7 • Never Sleeps • Never Misses a Call
                  </p>
                  <div className="mt-6 pt-6 border-t border-green-300">
                    <p className="text-sm text-gray-600">
                      Call now and see how our AI handles inquiries, checks availability, and books lessons - just like it will for your driving school.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 rounded-xl p-8 text-center border-2 border-green-200">
                  <p className="text-gray-600">AI receptionist phone number will be displayed here once configured.</p>
                </div>
              )}
            </div>

            <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
              <h4 className="font-semibold text-gray-900 mb-2">💡 Recovered Revenue Calculator</h4>
              <p className="text-gray-700">
                Average driving instructor misses 3-5 calls per week while teaching. At £500 average package value, that&apos;s <strong className="text-blue-600">£1,500-£2,500 in lost revenue every week</strong>. Your AI receptionist pays for itself instantly.
              </p>
            </div>
          </div>
        </section>

        {/* Why Instructors Choose Us */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">Why Instructors Choose DriveBook</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white border-2 border-green-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Zero Setup Fees</h3>
              <p className="text-gray-700">Start with a free trial - no credit card required. Only pay a small platform fee per completed lesson.</p>
            </div>
            
            <div className="bg-white border-2 border-green-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">More Students</h3>
              <p className="text-gray-700">Appear in local searches when learners are actively looking. Get discovered by students in your area right now.</p>
            </div>
            
            <div className="bg-white border-2 border-green-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Automated Admin</h3>
              <p className="text-gray-700">Stop chasing payments and managing spreadsheets. We handle scheduling, payments, and reminders automatically.</p>
            </div>
            
            <div className="bg-white border-2 border-green-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Weekly Payouts</h3>
              <p className="text-gray-700">Get paid every week via direct deposit. Transparent fee structure with no hidden costs.</p>
            </div>
            
            <div className="bg-white border-2 border-green-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Full Control</h3>
              <p className="text-gray-700">Set your own availability, pricing, and cancellation policy. You&apos;re in complete control of your schedule.</p>
            </div>
            
            <div className="bg-white border-2 border-green-100 p-6 rounded-xl hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Professional Dashboard</h3>
              <p className="text-gray-700">Manage your calendar, track earnings, view student notes, and monitor performance all in one place.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-green-50 p-8 rounded-xl border-l-4 border-green-500 my-16">
          <h2 className="text-3xl mb-6 text-gray-900">How It Works - Get Started in 3 Steps</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold">1</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Sign Up & Create Your Profile</h3>
                <p className="text-gray-700">Complete your instructor profile with credentials, availability, and pricing. Takes less than 10 minutes.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold">2</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Get Verified</h3>
                <p className="text-gray-700">Submit your credentials for verification. We check your license, insurance, and background to ensure quality.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold">3</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Receiving Bookings</h3>
                <p className="text-gray-700">Go live and start receiving bookings. Your AI receptionist is ready to handle calls 24/7 from day one.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">What Instructors Say</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <blockquote className="border-l-4 border-green-600 p-6 bg-gray-50 rounded-r-lg">
              <p className="text-gray-700 italic mb-4">
                &quot;Since joining DriveBook, my bookings have doubled. The AI receptionist handles calls while I&apos;m teaching, and I get paid on time every week. Game changer!&quot;
              </p>
              <p className="font-semibold text-gray-900">— James T., Driving Instructor, London</p>
            </blockquote>
            
            <blockquote className="border-l-4 border-green-600 p-6 bg-gray-50 rounded-r-lg">
              <p className="text-gray-700 italic mb-4">
                &quot;I used to spend hours managing spreadsheets and chasing payments. Now everything is automated. I can focus on teaching instead of admin work.&quot;
              </p>
              <p className="font-semibold text-gray-900">— Sarah M., Driving Instructor, Manchester</p>
            </blockquote>
            
            <blockquote className="border-l-4 border-green-600 p-6 bg-gray-50 rounded-r-lg">
              <p className="text-gray-700 italic mb-4">
                &quot;The AI receptionist is incredible. I never miss a booking anymore, even when I&apos;m in the car all day. My revenue has increased by 40%.&quot;
              </p>
              <p className="font-semibold text-gray-900">— David K., Driving Instructor, Birmingham</p>
            </blockquote>
            
            <blockquote className="border-l-4 border-green-600 p-6 bg-gray-50 rounded-r-lg">
              <p className="text-gray-700 italic mb-4">
                &quot;Best decision I made for my driving school. The platform is easy to use, students love the booking system, and I get paid weekly without any hassle.&quot;
              </p>
              <p className="font-semibold text-gray-900">— Emma R., Driving Instructor, Leeds</p>
            </blockquote>
          </div>
        </section>

        {/* Pricing */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">Simple, Transparent Pricing</h2>
          <div className="max-w-2xl mx-auto bg-white border-2 border-green-200 rounded-2xl p-8 shadow-lg">
            <div className="text-center mb-6">
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Pay Per Completed Lesson</h3>
              <p className="text-xl text-gray-600">No monthly fees. No hidden costs.</p>
            </div>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                <span className="text-gray-700"><strong>Free trial</strong> - Test the platform with no commitment</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                <span className="text-gray-700"><strong>Small platform fee</strong> - Only charged on completed lessons</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                <span className="text-gray-700"><strong>AI receptionist included</strong> - Free 24/7 call handling</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                <span className="text-gray-700"><strong>Weekly payouts</strong> - Direct deposit every week</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 text-xl flex-shrink-0">✓</span>
                <span className="text-gray-700"><strong>No setup fees</strong> - Start earning immediately</span>
              </li>
            </ul>

            <div className="text-center">
              <Link href="/register" className="inline-block bg-green-600 text-white px-10 py-4 rounded-lg no-underline font-bold text-lg hover:bg-green-700 hover:-translate-y-1 transition-all shadow-lg">
                Start Your Free Trial →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="my-16">
          <h2 className="text-4xl text-center mb-10 text-gray-800">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-green-600 text-lg">Q: How much does it cost to join?</strong></p>
              <p className="text-gray-700">A: Start with a free trial. After that, we charge a small platform fee per completed lesson - no monthly fees or hidden costs.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-green-600 text-lg">Q: How do I get paid?</strong></p>
              <p className="text-gray-700">A: Payments are processed weekly via direct deposit. You can track all earnings in your instructor dashboard in real-time.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-green-600 text-lg">Q: Can I set my own availability and pricing?</strong></p>
              <p className="text-gray-700">A: Absolutely! You control your schedule completely. Set your working hours, block off time, update availability in real-time, and set your own pricing.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-green-600 text-lg">Q: What if a student doesn&apos;t show up?</strong></p>
              <p className="text-gray-700">A: Our automated SMS reminders reduce no-shows significantly. You can also set your own cancellation policy and charge for late cancellations.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-green-600 text-lg">Q: How does the AI receptionist work?</strong></p>
              <p className="text-gray-700">A: The AI answers calls 24/7, checks your real-time availability, books lessons, and sends SMS confirmations - all automatically while you focus on teaching.</p>
            </div>
            
            <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
              <p className="mb-2"><strong className="text-green-600 text-lg">Q: What credentials do I need?</strong></p>
              <p className="text-gray-700">A: You need a valid driving instructor license, comprehensive insurance, and a clean background check. We verify all credentials before you go live.</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-green-600 to-green-800 text-white p-12 rounded-2xl text-center my-16 shadow-2xl">
          <h2 className="text-4xl font-bold mb-4 mt-0">Ready to Grow Your Driving School?</h2>
          <p className="text-xl mb-8">Join DriveBook today and start receiving bookings with zero setup fees. Your AI receptionist is waiting.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register" className="inline-block bg-white text-green-600 px-10 py-5 rounded-lg no-underline font-bold text-lg hover:-translate-y-1 hover:shadow-2xl transition-all">
              Start Your Free Trial →
            </Link>
            {VOICE_NUMBER && (
              <a href={`tel:${VOICE_NUMBER}`} className="inline-block bg-green-500 text-white px-10 py-5 rounded-lg no-underline font-bold text-lg hover:-translate-y-1 hover:shadow-2xl transition-all border-2 border-white">
                Or Call {VOICE_NUMBER}
              </a>
            )}
          </div>
          <p className="mt-6 text-green-100">
            Looking for driving lessons? <Link href="/" className="text-white underline font-semibold hover:text-green-200">Find an instructor near you →</Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-10 px-5 text-center mt-16">
        <p>DriveBook - Empowering driving instructors to grow their business</p>
        <p className="mt-4 text-sm">Last updated: March 9, 2026</p>
      </footer>
    </div>
  )
}
