import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | DriveBook',
  description: 'DriveBook Privacy Policy — how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: March 2026 · Version 1.0</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Who We Are</h2>
            <p>DriveBook Pty Ltd ("DriveBook", "we", "us") operates the DriveBook platform at <a href="https://drivebook.com.au" className="text-purple-600 hover:underline">drivebook.com.au</a>. We are committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).</p>
            <p className="mt-3">Questions about this policy? Contact us at <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="font-semibold text-gray-800 mb-2">Information you provide:</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Name, email address, and phone number when you register</li>
              <li>Profile information (for instructors: qualifications, service areas, vehicle details)</li>
              <li>Booking details including pickup address and lesson preferences</li>
              <li>Payment information (processed by Stripe — we do not store card numbers)</li>
              <li>Reviews and feedback you submit</li>
            </ul>
            <h3 className="font-semibold text-gray-800 mb-2 mt-4">Information collected automatically:</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>IP address and browser/device information</li>
              <li>Pages visited and actions taken on the platform</li>
              <li>Session data and cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Create and manage your account</li>
              <li>Process bookings and payments</li>
              <li>Send booking confirmations, reminders, and receipts via email and SMS</li>
              <li>Connect clients with instructors</li>
              <li>Verify instructor credentials and qualifications</li>
              <li>Resolve disputes and provide customer support</li>
              <li>Improve the platform and detect fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Sharing Your Information</h2>
            <p>We share your information only as necessary:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>With your instructor/client:</strong> Booking details (name, phone, pickup address) are shared between the booked parties to facilitate the lesson.</li>
              <li><strong>Stripe:</strong> Payment processing. Stripe's privacy policy applies to payment data.</li>
              <li><strong>Twilio:</strong> SMS notifications for booking confirmations and reminders.</li>
              <li><strong>Google:</strong> Maps API for location services. No personal data is sent to Google beyond what is needed for address lookup.</li>
              <li><strong>Cloudinary:</strong> Profile and vehicle image storage.</li>
              <li><strong>Law enforcement:</strong> Where required by law or to protect the safety of users.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Cookies</h2>
            <p>We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Keep you logged in (session cookies)</li>
              <li>Remember your preferences</li>
              <li>Analyse platform usage to improve the service</li>
            </ul>
            <p className="mt-3">You can disable cookies in your browser settings, but some features of the platform may not work correctly without them.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
            <p>We take reasonable steps to protect your personal information from misuse, loss, and unauthorised access. These include:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>HTTPS encryption for all data in transit</li>
              <li>Passwords stored using bcrypt hashing (never in plain text)</li>
              <li>Payment data handled exclusively by Stripe (PCI-DSS Level 1 certified)</li>
              <li>Access controls limiting which staff can access personal data</li>
            </ul>
            <p className="mt-3">No system is 100% secure. If you believe your account has been compromised, contact us immediately at <a href="mailto:security@drivebook.com.au" className="text-purple-600 hover:underline">security@drivebook.com.au</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account data is retained while your account is active.</li>
              <li>Booking and transaction records are retained for 7 years for financial and legal compliance.</li>
              <li>If you close your account, personal data is deleted or anonymised within 90 days, except where retention is required by law.</li>
              <li>Wallet credits expire after 365 days of inactivity (see Wallet Terms in our Terms of Service).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Your Rights</h2>
            <p>Under the Australian Privacy Principles, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Access</strong> the personal information we hold about you</li>
              <li><strong>Correct</strong> inaccurate or outdated information</li>
              <li><strong>Request deletion</strong> of your account and personal data (subject to legal retention requirements)</li>
              <li><strong>Opt out</strong> of marketing communications at any time</li>
            </ul>
            <p className="mt-3">To exercise these rights, email <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Children's Privacy</h2>
            <p>DriveBook is not directed at children under 16. We do not knowingly collect personal information from children under 16. If you believe a child has provided us with personal information, contact us and we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you by email of material changes. The updated policy will be posted on this page with a revised date.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Complaints</h2>
            <p>If you have a complaint about how we handle your personal information, contact us first at <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>. We will respond within 30 days. If we cannot resolve your complaint, you may contact the <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Office of the Australian Information Commissioner (OAIC)</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Governing Law</h2>
            <p>This Privacy Policy is governed by the laws of Western Australia. Any disputes are subject to the non-exclusive jurisdiction of the courts of Western Australia.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Contact</h2>
            <div className="p-4 bg-gray-50 rounded-lg text-sm">
              <p><strong>DriveBook Pty Ltd — Privacy Officer</strong></p>
              <p>Email: <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a></p>
              <p>Website: <a href="https://drivebook.com.au" className="text-purple-600 hover:underline">drivebook.com.au</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/terms" className="text-purple-600 hover:underline">Terms of Service</Link>
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
