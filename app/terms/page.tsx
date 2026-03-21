import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | DriveBook',
  description: 'DriveBook Terms of Service — the rules governing use of the platform for learners and instructors.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-white shadow-sm py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-purple-600">DriveBook</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-700 hover:text-purple-600 font-medium">Login</Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700">Sign Up</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Last updated: March 2026 · Version 1.0</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. About DriveBook</h2>
            <p>DriveBook ("we", "us", "our") is an online marketplace that connects learner drivers ("Clients") with independent driving instructors ("Instructors") in Australia. DriveBook is operated by DriveBook Pty Ltd (ABN: [Your ABN]).</p>
            <p className="mt-3">By creating an account or using the platform, you agree to these Terms of Service. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Eligibility</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must be at least 16 years old to create an account.</li>
              <li>Clients booking lessons must hold a valid learner's permit for the relevant state or territory.</li>
              <li>Instructors must hold a valid driving instructor accreditation and current insurance.</li>
              <li>You must provide accurate information when registering.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Bookings</h2>
            <p>When a Client books a lesson through DriveBook:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>A binding agreement is formed between the Client and the Instructor.</li>
              <li>DriveBook acts as the booking and payment intermediary — we are not a party to the lesson itself.</li>
              <li>Lesson times, locations, and details are agreed between Client and Instructor at the time of booking.</li>
              <li>Clients must arrive on time. No-shows are treated as same-day cancellations with no refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Payments</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All payments are processed securely through Stripe. DriveBook does not store card details.</li>
              <li>Prices are displayed in Australian Dollars (AUD) and include GST where applicable.</li>
              <li>Payment is required at the time of booking. Lessons are not confirmed until payment is received.</li>
              <li>DriveBook charges a platform fee (deducted from the instructor's payout). This fee is not charged to the Client separately.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Cancellation & Refund Policy</h2>
            <p>The following refund tiers apply to all bookings:</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full border border-gray-200 rounded-lg text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700 border-b">Notice Given</th>
                    <th className="text-left p-3 font-semibold text-gray-700 border-b">Client Refund</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">48 hours or more before lesson</td>
                    <td className="p-3 text-green-700 font-medium">100% refund</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">24–48 hours before lesson</td>
                    <td className="p-3 text-amber-700 font-medium">50% refund</td>
                  </tr>
                  <tr>
                    <td className="p-3">Less than 24 hours before lesson</td>
                    <td className="p-3 text-red-700 font-medium">No refund</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Refunds are credited to your DriveBook wallet immediately and can be used for future bookings or withdrawn to your original payment method.</li>
              <li>If an Instructor cancels, the Client receives a 100% refund regardless of notice period.</li>
              <li>Rescheduling is subject to the same policy as cancellation based on the original booking time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. DriveBook Wallet</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>The DriveBook Wallet is a prepaid credit system for paying for lessons.</li>
              <li>Wallet credits are denominated in AUD and are non-transferable between accounts.</li>
              <li>Credits expire after 365 days of account inactivity. You will be notified 30 days and 7 days before expiry.</li>
              <li>Minimum withdrawal to original payment method is $10.00. Processing takes 5–7 business days.</li>
              <li>The wallet is not a bank account and is not covered by the Financial Claims Scheme.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Instructor Terms</h2>
            <p>Instructors using DriveBook agree to the following:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Instructors are independent contractors, not employees of DriveBook.</li>
              <li>Instructors are responsible for their own taxes, insurance, and vehicle maintenance.</li>
              <li>DriveBook charges a platform commission (currently 15% standard, 10% for a client's first booking with a new instructor).</li>
              <li>Payouts are processed within 48 hours of lesson completion, subject to admin approval.</li>
              <li>Minimum payout amount is $50.00.</li>
              <li>Instructors must maintain valid credentials and notify DriveBook of any changes to their accreditation or insurance.</li>
              <li>Repeated cancellations, poor reviews, or safety violations may result in account suspension or termination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Prohibited Conduct</h2>
            <p>You must not:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Provide false or misleading information on your profile or during booking.</li>
              <li>Attempt to circumvent the platform by arranging payments directly with the other party.</li>
              <li>Harass, threaten, or discriminate against other users.</li>
              <li>Use the platform for any unlawful purpose.</li>
              <li>Attempt to reverse-engineer, scrape, or interfere with the platform.</li>
            </ul>
            <p className="mt-3">Violations may result in immediate account suspension and forfeiture of any wallet balance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>DriveBook is a marketplace platform. We are not responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>The quality, safety, or outcome of any driving lesson.</li>
              <li>Any injury, accident, or damage occurring during a lesson.</li>
              <li>An instructor's failure to attend or perform a booked lesson.</li>
            </ul>
            <p className="mt-3">To the maximum extent permitted by Australian law, DriveBook's total liability to you for any claim is limited to the amount you paid for the relevant booking.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Dispute Resolution</h2>
            <p>If you have a dispute with another user, contact us at <a href="mailto:support@drivebook.com.au" className="text-purple-600 hover:underline">support@drivebook.com.au</a>. We will review the matter and make a final determination within 5 business days. DriveBook's decision is final.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you by email at least 14 days before material changes take effect. Continued use of the platform after that date constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Governing Law</h2>
            <p>These Terms are governed by the laws of New South Wales, Australia. Any disputes are subject to the exclusive jurisdiction of the courts of New South Wales.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm">
              <p><strong>DriveBook Pty Ltd</strong></p>
              <p>Email: <a href="mailto:legal@drivebook.com.au" className="text-purple-600 hover:underline">legal@drivebook.com.au</a></p>
              <p>Website: <a href="https://drivebook.com.au" className="text-purple-600 hover:underline">drivebook.com.au</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/contact" className="text-purple-600 hover:underline">Contact Us</Link>
          <span>·</span>
          <Link href="/" className="text-purple-600 hover:underline">Back to Home</Link>
        </div>
      </main>

      <footer className="bg-gray-800 text-white py-8 px-4 mt-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} DriveBook. All rights reserved.
      </footer>
    </div>
  )
}
