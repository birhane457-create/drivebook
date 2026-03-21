import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | DriveBook',
  description: 'DriveBook Privacy Policy — how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
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
          <p className="text-gray-500 text-sm">Last updated: March 2026 · Version 1.1</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Who We Are</h2>
            <p>DriveBook Pty Ltd ("DriveBook", "we", "us") operates the DriveBook platform at <a href="https://drivebook.com.au" className="text-purple-600 hover:underline">drivebook.com.au</a>. We are committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).</p>
            <p className="mt-3">By using DriveBook, you acknowledge and agree to this Privacy Policy and our <Link href="/terms" className="text-purple-600 hover:underline">Terms and Conditions</Link>.</p>
            <p className="mt-3">Questions about this policy? Contact us at <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="font-semibold text-gray-800 mb-2">Information you provide (Learners):</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, date of birth, email address, and phone number</li>
              <li>Pickup address and lesson preferences</li>
              <li>Payment information (processed by Stripe — we do not store card numbers)</li>
              <li>Reviews and feedback you submit</li>
            </ul>
            <h3 className="font-semibold text-gray-800 mb-2 mt-4">Information you provide (Instructors):</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, date of birth, gender, email address, and phone number</li>
              <li>Driver's licence and Driving Instructor licence details</li>
              <li>Working With Children Check (WWCC) number</li>
              <li>Vehicle registration number and vehicle details</li>
              <li>Service areas, availability, and pricing</li>
              <li>Profile photo and vehicle images</li>
            </ul>
            <h3 className="font-semibold text-gray-800 mb-2 mt-4">Information collected automatically:</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address, browser type, and device information</li>
              <li>Pages visited, actions taken, and session data</li>
              <li>General geographic location derived from IP address (used to show relevant content)</li>
              <li>Referral URLs and advertisement interaction data</li>
              <li>Cookies and similar tracking technologies (see Section 5)</li>
            </ul>
            <p className="mt-3">Where you provide information about a third party, you warrant that you have that person's consent to do so.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Create and manage your account</li>
              <li>Process bookings and payments</li>
              <li>Share booking details between matched Learners and Instructors (name, phone number, email, and pickup address) to facilitate lessons</li>
              <li>Send booking confirmations, reminders, and receipts via email and SMS</li>
              <li>Verify instructor credentials and qualifications</li>
              <li>Resolve disputes and provide customer support</li>
              <li>Improve the platform and detect fraud or illegal activity</li>
              <li>Comply with legal obligations</li>
              <li>Send marketing communications where you have consented (you may opt out at any time)</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Sharing Your Information</h2>
            <p>We share your information only as necessary to operate the platform:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Between Learners and Instructors:</strong> When a booking is confirmed, the Learner's name, phone number, and pickup address are shared with the Instructor. The Instructor's name, phone number, and email are shared with the Learner.</li>
              <li><strong>Stripe:</strong> Payment processing. We do not store or process credit card details directly. Stripe is PCI-DSS Level 1 certified. By using DriveBook, you also accept <a href="https://stripe.com/au/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Stripe's Privacy Policy</a>.</li>
              <li><strong>Twilio:</strong> SMS delivery for booking notifications and reminders. SMS opt-in data and consent is not shared with any third party for marketing or promotional purposes.</li>
              <li><strong>Google Maps API:</strong> Address lookup and location services. Only the address string is sent — no personal identifiers.</li>
              <li><strong>Cloudinary:</strong> Profile and vehicle image storage.</li>
              <li><strong>Law enforcement / regulators:</strong> Where required by law, court order, or to protect the safety of users or the public.</li>
            </ul>
            <p className="mt-3">All third-party service providers are bound by confidentiality obligations and may only use your data to perform services on our behalf.</p>

            <h3 className="font-semibold text-gray-800 mb-2 mt-4">4.1 Third-Party Service Disclaimer</h3>
            <p>DriveBook integrates with third-party services including Stripe, Twilio, Google, and Cloudinary. While we take care in selecting reliable providers, DriveBook is not responsible for outages, security breaches, or data losses caused by these third-party services. We recommend reading their respective privacy policies before use.</p>

            <h3 className="font-semibold text-gray-800 mb-2 mt-4">4.2 International Data Transfers</h3>
            <p>Some of our third-party providers (including Stripe and Twilio) may process or store data outside Australia. Where this occurs, we take reasonable steps to ensure your data is handled in accordance with the APPs and applicable international standards. By using DriveBook, you consent to this transfer where necessary for service delivery.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Cookies</h2>
            <p>We use the following types of cookies:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Necessary cookies:</strong> Authentication (keeping you logged in), security, and essential platform functionality.</li>
              <li><strong>Preference cookies:</strong> Remembering your settings and preferences.</li>
              <li><strong>Analytics cookies:</strong> Understanding how the platform is used to improve our services (e.g. Google Analytics). This data is aggregated and anonymised where possible.</li>
              <li><strong>Advertising cookies:</strong> Serving relevant DriveBook ads on other platforms and measuring engagement.</li>
            </ul>
            <p className="mt-3">You can control or disable cookies through your browser settings. Disabling necessary cookies may affect platform functionality. Some third parties (e.g. Google) may use their own cookies — we recommend reading their privacy policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
            <p>We take reasonable steps to protect your personal information from misuse, loss, and unauthorised access. Our measures include:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>HTTPS / SSL-TLS encryption for all data in transit</li>
              <li>Passwords stored using bcrypt hashing (never in plain text)</li>
              <li>Payment data handled exclusively by Stripe (PCI-DSS Level 1 certified — we do not store card numbers)</li>
              <li>Access controls limiting which staff can access personal data</li>
              <li>Regular security reviews and updates</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mb-2 mt-4">6.1 Your Responsibilities</h3>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Maintaining a strong, unique password for your account</li>
              <li>Not sharing your login credentials with others</li>
              <li>Enabling two-factor authentication (2FA) where available</li>
              <li>Reporting any suspected unauthorised access immediately to <a href="mailto:security@drivebook.com.au" className="text-purple-600 hover:underline">security@drivebook.com.au</a></li>
            </ul>
            <p className="mt-3">No system is 100% secure. By providing us with your personal information, you acknowledge this inherent risk.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account data is retained while your account is active.</li>
              <li>Booking and transaction records are retained for 7 years for financial and legal compliance.</li>
              <li>If you close your account, personal data is deleted or anonymised within <strong>30 days</strong>, except where retention is required by law (e.g. tax records, fraud prevention, or active disputes).</li>
              <li>Wallet credits expire after 365 days of account inactivity (see Wallet Terms in our <Link href="/terms" className="text-purple-600 hover:underline">Terms of Service</Link>).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. SMS Communications</h2>
            <p>By providing your mobile number and creating an account, you consent to receive SMS messages from DriveBook for booking confirmations, reminders, and account notifications.</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Reply <strong>STOP</strong> to opt out of SMS at any time. Reply <strong>HELP</strong> for assistance.</li>
              <li>Message and data rates may apply.</li>
              <li>SMS messages are delivered via Twilio. SMS opt-in data and consent is <strong>not</strong> shared with any third party for marketing or promotional purposes. Twilio acts solely as a delivery provider.</li>
              <li>DriveBook's SMS practices comply with the <em>Spam Act 2003</em> (Cth).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Your Rights</h2>
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Children's Privacy</h2>
            <p>DriveBook is not directed at children under 16. We do not knowingly collect personal information from children under 16. If you believe a child has provided us with personal information, contact us and we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you by email of material changes. The updated policy will be posted on this page with a revised date. Continued use of DriveBook after an update constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Complaints</h2>
            <p>If you have a complaint about how we handle your personal information, contact us first at <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>. We will respond within 30 days. If we cannot resolve your complaint, you may contact the <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Office of the Australian Information Commissioner (OAIC)</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Governing Law</h2>
            <p>This Privacy Policy is governed by the laws of Western Australia. Any disputes are subject to the non-exclusive jurisdiction of the courts of Western Australia.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">14. Contact</h2>
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
