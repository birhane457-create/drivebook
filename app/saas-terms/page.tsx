import Link from 'next/link'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'SaaS Terms | DriveBook',
  description: 'DriveBook SaaS Terms — the agreement governing providers who use DriveBook as a business management platform.',
}

export default function SaasTermsPage() {
  return (
    <div className="light min-h-screen bg-white">
      <nav className="bg-white shadow-sm py-4 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="no-underline"><Logo size={32} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-700 hover:text-purple-600 font-medium">Login</Link>
            <Link href="/register" className="bg-purple-600 text-foreground px-5 py-2 rounded-lg font-medium hover:bg-purple-700">Sign Up</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Status banner — remove once terms are finalised and effective */}
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Not yet in effect.</strong> These terms are being finalised. They are published here for transparency
          and preview purposes only. They do not yet apply to any registered provider. When the terms become effective,
          all SaaS providers will be notified by email and asked to review and accept them before commercial features are activated.
        </div>

        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            For SaaS Providers — Driving Instructors (SaaS) and Tradespeople
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">DriveBook SaaS Terms</h1>
          <p className="text-muted-foreground/60 text-sm">Version TBD · Effective date: TBD · Last Updated: TBD</p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            These terms apply to <strong>SaaS providers</strong> — driving instructors who bring their own students
            and use DriveBook for scheduling and business management, and non-driving professionals (plumbers,
            electricians, beauty professionals, tax agents) who use DriveBook for client and booking management.
            If you are a driving instructor joining the DriveBook Marketplace, please read the{' '}
            <Link href="/instructor-terms" className="underline font-medium">Instructor Terms and Conditions</Link> instead.
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Parties</h2>
            <p>
              This Agreement is between <strong>DriveBook</strong> (the platform operator) and the{' '}
              <strong>Provider</strong> who registers and uses DriveBook under a SaaS arrangement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. What DriveBook provides</h2>
            <p>Under a SaaS arrangement, DriveBook provides booking, scheduling, and client management tools. DriveBook does not process payments on the provider&rsquo;s behalf or take commission on bookings. The provider is responsible for collecting payment from their own clients through their own payment methods.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Subscription</h2>
            <p>
              Continued access to DriveBook features requires an active subscription. Subscription tiers, pricing,
              and features will be detailed in the finalised version of these terms. During the preview period,
              all SaaS accounts operate on a trial subscription.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Provider responsibilities</h2>
            <p>Providers are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Maintaining all licences, registrations, and insurance required for their profession.</li>
              <li>Ensuring all information in their profile is accurate and current.</li>
              <li>Collecting payment from clients independently — DriveBook does not process client payments for SaaS accounts.</li>
              <li>Complying with all applicable laws including consumer protection, privacy, and professional standards.</li>
              <li>Complying with DriveBook&rsquo;s <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link> when handling client personal information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Privacy</h2>
            <p>
              DriveBook handles provider and client data in accordance with its{' '}
              <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>.
              By registering, the provider consents to the collection and use of their information as described there.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Modifications</h2>
            <p>
              DriveBook may update these terms. Providers will be notified of material changes with reasonable notice.
              Continued use after the notice period constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Governing law</h2>
            <p>
              These terms are governed by the laws of Western Australia, Australia. Any disputes are subject to the
              exclusive jurisdiction of the courts of Western Australia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact</h2>
            <p>
              Questions about these terms can be directed to{' '}
              <a href="mailto:legal@drivebook.com.au" className="text-purple-600 hover:underline">legal@drivebook.com.au</a>.
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
