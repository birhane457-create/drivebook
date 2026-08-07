import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Privacy Policy | DriveBook',
  description: 'DriveBook Privacy Policy — how we collect, use, disclose and otherwise handle your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="no-underline"><Logo size={32} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-700 hover:text-purple-600 font-medium">Login</Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700">Sign Up</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Version 2.0 · Effective: 6 August 2026 · Last Updated: 6 August 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          {/* 1. Introduction */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              By using DriveBook or providing personal information to us, you acknowledge that we collect, use, disclose and otherwise handle your personal information as described in this Privacy Policy. This Privacy Policy should be read together with the applicable{' '}
              <Link href="/terms" className="text-purple-600 hover:underline">Learner Terms of Service</Link> or{' '}
              <Link href="/instructor-terms" className="text-purple-600 hover:underline">Instructor Terms and Conditions</Link>.
            </p>
            <p className="mt-3">
              DriveBook supports individual learners, independent driving instructors, and may support business or driving school accounts. Where applicable, authorised business owners and administrators may access information necessary to manage bookings, instructors and learner services in accordance with this Privacy Policy.
            </p>
          </section>

          {/* 2. Who We Are */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Who We Are</h2>
            <p>
              DriveBook ("we", "us") operates the DriveBook platform at{' '}
              <a href="https://drivebook.com.au" className="text-purple-600 hover:underline">drivebook.com.au</a>.
              We are committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
            </p>
            <p className="mt-3">
              Questions about this policy? Contact us at{' '}
              <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>.
            </p>
          </section>

          {/* 3. Information We Collect */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Information We Collect</h2>

            <h3 className="font-semibold text-gray-800 mb-2">Information you provide — Learners</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Pickup address and lesson preferences</li>
              <li>Payment information (processed by Stripe — we do not store card numbers)</li>
              <li>Booking history, lesson history, and payment history</li>
              <li>Reviews and feedback you submit</li>
              <li>Support requests and communications with DriveBook</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mb-2 mt-5">Information you provide — Instructors</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Business name (for BUSINESS tier accounts)</li>
              <li>Australian Business Number (ABN)</li>
              <li>Base address, service areas, hourly rate, and vehicle type</li>
              <li>Driver's licence number and insurance policy number</li>
              <li>Compliance documents (WWCC, police clearance, vehicle registration, certifications)</li>
              <li>Payout information (bank account details or Stripe Connect information)</li>
              <li>Profile photo and vehicle images</li>
              <li>Profile settings, availability, and working hours</li>
              <li>Student records, lesson history, and assessment notes</li>
              <li>Earnings and transaction history</li>
              <li>Support requests and communications with DriveBook</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mb-2 mt-5">Information collected automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address, browser type, and device information</li>
              <li>Pages visited, actions taken, and session data</li>
              <li>General geographic location derived from IP address</li>
              <li>Referral URLs and advertisement interaction data</li>
              <li>Analytics data (aggregated and anonymised where possible)</li>
              <li>Cookies and similar tracking technologies (see Section 7)</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mb-2 mt-5">Information generated through AI-assisted services</h3>
            <p>
              Where you interact with AI-assisted features — including voice calls, booking assistants, or automated customer service — we may collect and process information including voice interactions, call transcripts, booking requests, appointment preferences, and customer enquiries. See Section 5 for full details.
            </p>

            <p className="mt-4">
              Where you provide information about a third party, you warrant that you have that person's consent to do so.
            </p>
          </section>

          {/* 4. How We Use Information */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Create and manage your account</li>
              <li>Process bookings and payments</li>
              <li>Share booking details between matched Learners and Instructors to facilitate lessons</li>
              <li>Send booking confirmations, reminders, and receipts via email and SMS</li>
              <li>Verify instructor credentials and qualifications</li>
              <li>Resolve disputes and provide customer support</li>
              <li>Operate AI-assisted booking services and customer interactions</li>
              <li>Verify identity and prevent fraud or illegal activity</li>
              <li>Monitor platform quality and investigate complaints</li>
              <li>Provide instructor analytics and performance reporting</li>
              <li>Improve the platform, AI models, and automation systems (where permitted)</li>
              <li>Comply with legal, insurance, and regulatory obligations</li>
              <li>Send marketing communications where you have consented (you may opt out at any time)</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          {/* 5. AI-Assisted Services */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. AI-Assisted Services</h2>
            <p>
              DriveBook uses artificial intelligence (AI), large language models (LLMs), and automated systems to assist with customer enquiries, phone calls, booking requests, appointment scheduling, profile generation, and customer support.
            </p>
            <p className="mt-3">Information you provide during AI interactions may be processed to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Answer questions and assist with bookings</li>
              <li>Send confirmations and notifications</li>
              <li>Improve service quality and AI model performance</li>
              <li>Detect fraud and maintain platform security</li>
            </ul>
            <p className="mt-3">
              Calls to DriveBook's AI voice service are recorded and transcribed to facilitate booking requests and improve service quality. Where required by law, callers will be notified before a call is recorded.
            </p>
            <p className="mt-3">
              AI-generated responses may occasionally be inaccurate or incomplete and should not be relied upon as professional, legal, or financial advice.
            </p>
            <p className="mt-3">
              <strong>AI and decision-making:</strong> AI assists with administrative and customer service functions. AI does not make final decisions about instructor approval, account suspension, payment disputes, or other significant account actions without appropriate human oversight.
            </p>
            <p className="mt-3">
              Where available, users may request assistance through alternative support channels by contacting{' '}
              <a href="mailto:support@drivebook.com.au" className="text-purple-600 hover:underline">support@drivebook.com.au</a>.
            </p>
          </section>

          {/* 6. Sharing Your Information */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Sharing Your Information</h2>
            <p>
              We share your information only as necessary to operate the platform. We use trusted service providers for payment processing, communications, cloud hosting, mapping, artificial intelligence and large language model (LLM) services, analytics, and media storage. Examples of current providers include Stripe, Twilio, Google, and Cloudinary. Specific AI and LLM service providers may change from time to time as the platform evolves. All providers are required to handle your data in accordance with applicable privacy laws and are bound by confidentiality obligations.
            </p>
            <p className="mt-3">Specific sharing arrangements include:</p>
            <ul className="list-disc pl-6 space-y-3 mt-3">
              <li>
                <strong>Between Learners and Instructors:</strong> When a booking is confirmed, the Learner's name, phone number, and pickup address are shared with the Instructor. The Instructor's name, phone number, and email are shared with the Learner.
              </li>
              <li>
                <strong>Business and Driving School Accounts:</strong> Where an Instructor operates under a DriveBook Business or driving school account, relevant booking information may also be shared with authorised school owners, administrators, or staff responsible for managing bookings and learner services.
              </li>
              <li>
                <strong>Payment processors:</strong> Payment information is processed by Stripe (PCI-DSS Level 1 certified). We do not store or process credit card details directly. By using DriveBook, you also accept{' '}
                <a href="https://stripe.com/au/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Stripe's Privacy Policy</a>.
              </li>
              <li>
                <strong>AI, LLM, and voice services:</strong> We use trusted artificial intelligence, large language model (LLM), and voice communications providers to deliver AI-assisted customer service, booking assistance, voice interactions, and content generation. These providers process information only as required to provide services on our behalf and are bound by confidentiality obligations. The specific providers used may change from time to time as the platform evolves.
              </li>
              <li>
                <strong>SMS delivery:</strong> SMS messages are delivered via Twilio. SMS opt-in data and consent is not shared with any third party for marketing or promotional purposes.
              </li>
              <li>
                <strong>Mapping services:</strong> Google Maps API is used for address lookup and location services. Only the address string is sent — no personal identifiers.
              </li>
              <li>
                <strong>Media storage:</strong> Profile photos, vehicle images, and compliance documents are stored via Cloudinary.
              </li>
              <li>
                <strong>Law enforcement / regulators:</strong> Where required by law, court order, or to protect the safety of users or the public.
              </li>
            </ul>

            <h3 className="font-semibold text-gray-800 mb-2 mt-5">6.1 Third-Party Service Providers</h3>
            <p>
              All third-party service providers listed in this section operate under their own terms of service and privacy policies, which we recommend reading before use. While DriveBook takes reasonable steps to select reputable providers and requires them to handle your data in accordance with applicable privacy laws, DriveBook cannot be held responsible for outages, security incidents, or data losses that occur within those providers' own systems.
            </p>

            <h3 className="font-semibold text-gray-800 mb-2 mt-4">6.2 International Data Transfers</h3>
            <p>
              Some of our service providers may process or store data outside Australia. Where this occurs, we take reasonable steps to ensure your data is handled in accordance with the APPs and applicable international standards. By using DriveBook, you consent to this transfer where necessary for service delivery.
            </p>
          </section>

          {/* 7. Cookies */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Cookies</h2>
            <p>We use the following types of cookies:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Necessary cookies:</strong> Authentication, security, and essential platform functionality.</li>
              <li><strong>Preference cookies:</strong> Remembering your settings and preferences.</li>
              <li><strong>Analytics cookies:</strong> Understanding how the platform is used to improve our services. This data is aggregated and anonymised where possible.</li>
              <li><strong>Advertising cookies:</strong> Serving relevant DriveBook ads and measuring engagement.</li>
            </ul>
            <p className="mt-3">
              You can control or disable cookies through your browser settings. Disabling necessary cookies may affect platform functionality.
            </p>
          </section>

          {/* 8. Data Security */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Data Security</h2>
            <p>We take reasonable steps to protect your personal information. Our measures include:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>HTTPS / TLS encryption for all data in transit</li>
              <li>Passwords stored using bcrypt hashing — never in plain text</li>
              <li>Payment data handled exclusively by Stripe</li>
              <li>Encrypted database backups</li>
              <li>Role-based access controls limiting staff access to personal data</li>
              <li>Multi-factor authentication (MFA) for administrators where available</li>
              <li>Audit logging of significant data access and modification events</li>
              <li>Security monitoring and regular security reviews</li>
              <li>Incident response procedures</li>
            </ul>

            <h3 className="font-semibold text-gray-800 mb-2 mt-5">8.1 Your Responsibilities</h3>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Maintaining a strong, unique password for your account</li>
              <li>Not sharing your login credentials with others</li>
              <li>Reporting any suspected unauthorised access to{' '}
                <a href="mailto:security@drivebook.com.au" className="text-purple-600 hover:underline">security@drivebook.com.au</a>
              </li>
            </ul>
            <p className="mt-3">No system is 100% secure. By providing us with your personal information, you acknowledge this inherent risk.</p>

            <h3 className="font-semibold text-gray-800 mb-2 mt-5">8.2 Notifiable Data Breaches</h3>
            <p>
              If an eligible data breach occurs that is likely to result in serious harm, DriveBook will investigate and notify affected individuals and the Office of the Australian Information Commissioner (OAIC) as required by the <em>Privacy Act 1988</em> (Cth). We will take reasonable steps to contain and remediate any breach promptly.
            </p>
          </section>

          {/* 9. Data Retention */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account data is retained while your account is active.</li>
              <li>Booking and transaction records are retained for 7 years for financial, tax, and legal compliance.</li>
              <li>
                We take reasonable steps to delete or de-identify personal information within a reasonable period following account closure. In most cases, this will occur within 90 days, subject to legal, security, fraud prevention, dispute resolution, and backup retention requirements.
              </li>
              <li>Wallet credits expire after 365 days of account inactivity (see our <Link href="/terms" className="text-purple-600 hover:underline">Terms of Service</Link>).</li>
            </ul>
          </section>

          {/* 10. Your Rights */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Your Rights</h2>
            <p>Under the Australian Privacy Principles, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li><strong>Access</strong> the personal information we hold about you</li>
              <li><strong>Correct</strong> inaccurate or outdated information</li>
              <li><strong>Request deletion</strong> of your account and personal data, subject to legal retention requirements</li>
              <li><strong>Withdraw consent</strong> to marketing communications at any time</li>
              <li><strong>Complain</strong> about how we handle your personal information</li>
              <li><strong>Request information</strong> about overseas disclosures of your personal information</li>
            </ul>
            <p className="mt-3">
              We will verify your identity before releasing or modifying personal information. To exercise any of these rights, email{' '}
              <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>. We will respond within 30 days.
            </p>
          </section>

          {/* 11. Children & Minors */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Children and Minors</h2>
            <p>
              DriveBook is intended for individuals who are legally permitted to undertake driving lessons in their jurisdiction. Where required, parents or guardians may create bookings or accept responsibility on behalf of younger learners in accordance with our{' '}
              <Link href="/terms" className="text-purple-600 hover:underline">Learner Terms of Service</Link>.
            </p>
            <p className="mt-3">
              We do not knowingly collect personal information from individuals under the age of 16 who are not undertaking or preparing to undertake driving lessons. If you believe we hold such information inadvertently, contact us and we will promptly review and delete it where appropriate.
            </p>
          </section>

          {/* 12. Changes */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you by email of material changes. The updated policy will be posted on this page with a revised version number and effective date. Continued use of DriveBook after an update constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* 13. Complaints */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Complaints</h2>
            <p>
              If you have a complaint about how we handle your personal information, contact us first at{' '}
              <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>. We will acknowledge your complaint within 5 business days and respond within 30 days.
            </p>
            <p className="mt-3">
              If we cannot resolve your complaint, you may contact the{' '}
              <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Office of the Australian Information Commissioner (OAIC)</a>{' '}
              at <a href="https://www.oaic.gov.au/privacy/privacy-complaints" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">oaic.gov.au/privacy/privacy-complaints</a>.
            </p>
          </section>

          {/* 14. Contact */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">14. Contact</h2>
            <div className="p-5 bg-gray-50 rounded-lg text-sm space-y-3">
              <div>
                <p className="font-semibold text-gray-900">DriveBook</p>
                <p className="text-gray-600">Website: <a href="https://drivebook.com.au" className="text-purple-600 hover:underline">drivebook.com.au</a></p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                <div>
                  <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-1">Privacy Enquiries</p>
                  <a href="mailto:privacy@drivebook.com.au" className="text-purple-600 hover:underline">privacy@drivebook.com.au</a>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-1">Security Incidents</p>
                  <a href="mailto:security@drivebook.com.au" className="text-purple-600 hover:underline">security@drivebook.com.au</a>
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-1">General Support</p>
                  <a href="mailto:support@drivebook.com.au" className="text-purple-600 hover:underline">support@drivebook.com.au</a>
                </div>
              </div>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">15. Governing Law</h2>
            <p>
              This Privacy Policy is governed by the laws of Western Australia. Any disputes are subject to the non-exclusive jurisdiction of the courts of Western Australia, without prejudice to your rights under applicable Australian privacy legislation.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/terms" className="text-purple-600 hover:underline">Learner Terms</Link>
          <span>·</span>
          <Link href="/instructor-terms" className="text-purple-600 hover:underline">Instructor Terms</Link>
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
