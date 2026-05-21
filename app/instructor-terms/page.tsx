import Link from 'next/link'

export const metadata = {
  title: 'Instructor Terms and Conditions | DriveBook',
  description: 'DriveBook Instructor Terms and Conditions — the agreement governing driving instructors who use the DriveBook platform.',
}

export default function InstructorTermsPage() {
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

      <div className="max-w-6xl mx-auto px-4 py-16 flex gap-12">

        {/* Sticky TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-8 text-sm space-y-1">
            <p className="font-semibold text-gray-900 mb-3 text-xs uppercase tracking-wide">Contents</p>
            {[
              ['#parties', 'Parties'],
              ['#term', 'Term of Agreement'],
              ['#contractor', 'Independent Contractor'],
              ['#eligibility', 'Eligibility'],
              ['#approval', 'Approval Process'],
              ['#services', 'Platform Services'],
              ['#obligations', 'Instructor Obligations'],
              ['#subscription', 'Subscription'],
              ['#commission', 'Commission'],
              ['#payouts', 'Payout Terms'],
              ['#platform-guard', 'Platform Client Guard'],
              ['#documents', 'Document Obligations'],
              ['#conduct', 'Conduct Standards'],
              ['#cancellation', 'Cancellation by Instructor'],
              ['#data-access', 'Data Access'],
              ['#account-closure', 'Account Closure'],
              ['#ip', 'Intellectual Property'],
              ['#confidentiality', 'Confidentiality'],
              ['#liability', 'Liability'],
              ['#termination', 'Termination'],
              ['#disputes', 'Dispute Resolution'],
              ['#modification', 'Modification'],
              ['#governing-law', 'Governing Law'],
              ['#definitions', 'Definitions'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="block text-gray-500 hover:text-purple-600 py-0.5 pl-2 border-l-2 border-transparent hover:border-purple-400 transition-colors">
                {label}
              </a>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              For Driving Instructors Only
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Instructor Terms and Conditions</h1>
            <p className="text-gray-500 text-sm">Last updated: May 2026 · Version 1.0</p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              These terms apply to <strong>Driving Instructors</strong> who register and operate on the DriveBook platform. If you are a learner booking driving lessons, please read our <Link href="/terms" className="underline font-medium">Learner Terms and Conditions</Link> instead.
            </div>
          </div>

          <div className="space-y-2 text-gray-700 leading-relaxed">

            <section id="parties" className="mb-8 scroll-mt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Parties</h2>
              <p>This Agreement is between:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>DriveBook</strong> (operated by DriveBook Pty Ltd, ABN: [Your ABN], "DriveBook", "we", "us"); and</li>
                <li>the <strong>Instructor</strong> who has registered on the DriveBook platform and accepted this Agreement.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">OPERATIVE PROVISIONS</h2>

              <h3 id="term" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Term of Agreement</h3>
              <p className="mb-2">1. This Agreement commences on the date the Instructor accepts it digitally during registration and continues until an Event of Termination occurs.</p>
              <p className="mb-4">2. Acceptance of this Agreement is a condition of registration. By completing registration, the Instructor warrants they have read, understood, and agree to be bound by this Agreement.</p>

              <h3 id="contractor" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Independent Contractor Status</h3>
              <p className="mb-2">3. The Instructor is an independent contractor. Nothing in this Agreement creates an employment relationship, partnership, joint venture, or agency between the Instructor and DriveBook.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>3.1. The Instructor is solely responsible for their own tax obligations, including income tax, GST (if registered), and superannuation contributions.</li>
                <li>3.2. The Instructor is solely responsible for maintaining their own public liability insurance, professional indemnity insurance, and any other insurance required by law or their professional obligations.</li>
                <li>3.3. DriveBook does not direct or control how the Instructor delivers driving lessons. The Instructor determines their own methods, schedule, and approach to instruction.</li>
                <li>3.4. The Instructor has no authority to bind DriveBook in any contract, representation, or obligation.</li>
              </ul>

              <h3 id="eligibility" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Eligibility Requirements</h3>
              <p className="mb-2">4. To register and remain active on the DriveBook platform, the Instructor must at all times hold and maintain:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>4.1. a current and valid driving instructor accreditation issued by the relevant state or territory authority (in Western Australia, issued by the Department of Transport);</li>
                <li>4.2. current public liability insurance with a minimum coverage of $10,000,000 per occurrence;</li>
                <li>4.3. a current Working With Children Check (WWCC) or equivalent;</li>
                <li>4.4. a current National Police Clearance (issued within the last 3 years);</li>
                <li>4.5. a valid Australian Business Number (ABN); and</li>
                <li>4.6. a roadworthy, registered, and insured vehicle suitable for driving instruction.</li>
              </ul>
              <p className="mb-4">5. The Instructor warrants that all information provided during registration and throughout the term of this Agreement is true, accurate, and complete. Providing false or misleading information is grounds for immediate termination.</p>

              <h3 id="approval" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Approval Process</h3>
              <p className="mb-2">6. Registration does not guarantee approval. DriveBook reviews each application and may approve, reject, or request additional information at its sole discretion.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>6.1. DriveBook will endeavour to process applications within 2–5 business days of receiving all required documents.</li>
                <li>6.2. DriveBook may request additional documents, references, or information at any time during the approval process or after approval.</li>
                <li>6.3. Approval may be revoked at any time if DriveBook determines that the Instructor no longer meets the eligibility requirements or has breached this Agreement.</li>
                <li>6.4. During the approval period, the Instructor may access the dashboard to complete their profile and upload documents, but may not create bookings or accept students.</li>
              </ul>

              <h3 id="services" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Platform Services</h3>
              <p className="mb-2">7. Subject to the Instructor maintaining an active subscription and complying with this Agreement, DriveBook provides:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>7.1. a booking management system for scheduling and managing driving lessons;</li>
                <li>7.2. payment processing and wallet management for learner payments;</li>
                <li>7.3. a public booking page (subdomain) for the Instructor to share with prospective students;</li>
                <li>7.4. client management tools including client records, lesson history, and feedback;</li>
                <li>7.5. earnings tracking, payout management, and weekly receipts;</li>
                <li>7.6. analytics and performance reporting; and</li>
                <li>7.7. document management and compliance tracking.</li>
              </ul>
              <p className="mb-4">8. DriveBook may add, modify, or remove platform features at any time. Material changes will be communicated with reasonable notice.</p>

              <h3 id="obligations" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Instructor Obligations</h3>
              <p className="mb-2">9. The Instructor agrees to:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>9.1. maintain all eligibility requirements throughout the term of this Agreement;</li>
                <li>9.2. honour all confirmed bookings and arrive punctually;</li>
                <li>9.3. provide professional, safe, and competent driving instruction;</li>
                <li>9.4. treat all learners with respect and not discriminate on the basis of race, gender, age, disability, religion, sexual orientation, or any other protected characteristic;</li>
                <li>9.5. keep their profile information accurate and up to date, including availability, pricing, and credentials;</li>
                <li>9.6. not solicit learners to book lessons outside the DriveBook platform (see Platform Client Guard, clause 14);</li>
                <li>9.7. notify DriveBook immediately if their instructor accreditation, insurance, WWCC, or police check is suspended, cancelled, or expires;</li>
                <li>9.8. notify DriveBook immediately if they are charged with or convicted of any criminal offence;</li>
                <li>9.9. not use the platform for any unlawful purpose or in a manner that could harm DriveBook's reputation; and</li>
                <li>9.10. comply with all applicable laws, including road traffic laws, privacy laws, and anti-discrimination laws.</li>
              </ul>

              <h3 id="subscription" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Subscription</h3>
              <p className="mb-2">10. Access to the DriveBook platform requires an active paid subscription. The following tiers are available:</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border border-gray-200 rounded-lg text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700 border-b">Tier</th>
                      <th className="text-left p-3 font-semibold text-gray-700 border-b">Monthly</th>
                      <th className="text-left p-3 font-semibold text-gray-700 border-b">Annual</th>
                      <th className="text-left p-3 font-semibold text-gray-700 border-b">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b"><td className="p-3">BASIC</td><td className="p-3">$29/mo</td><td className="p-3">$290/yr</td><td className="p-3">15%</td></tr>
                    <tr className="border-b"><td className="p-3">PRO</td><td className="p-3">$79/mo</td><td className="p-3">$790/yr</td><td className="p-3">12%</td></tr>
                    <tr className="border-b"><td className="p-3">STUDIO</td><td className="p-3">$129/mo</td><td className="p-3">$1,290/yr</td><td className="p-3">11%</td></tr>
                    <tr><td className="p-3">BUSINESS</td><td className="p-3">$199/mo</td><td className="p-3">$1,990/yr</td><td className="p-3">10%</td></tr>
                  </tbody>
                </table>
              </div>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>10.1. All new accounts receive a 14-day free trial (30 days for BUSINESS tier) with full access to the selected tier's features. No payment method is required to start a trial.</li>
                <li>10.2. Subscriptions auto-renew at the end of each billing period. The Instructor may cancel auto-renewal at any time through the Stripe Billing Portal.</li>
                <li>10.3. If a payment fails, the Instructor's account enters read-only mode — they retain access to view all historical data (bookings, clients, earnings) but cannot create new bookings until payment is resolved.</li>
                <li>10.4. Subscription fees are non-refundable. No refund is issued for unused portions of a billing period upon cancellation.</li>
                <li>10.5. DriveBook may change subscription pricing with 30 days written notice. Continued use after the notice period constitutes acceptance of the new pricing.</li>
                <li>10.6. All subscription payments are processed by Stripe. By subscribing, the Instructor also agrees to <a href="https://stripe.com/au/legal" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Stripe's Terms of Service</a>.</li>
              </ul>

              <h3 id="commission" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Commission</h3>
              <p className="mb-2">11. DriveBook deducts a commission from each completed booking payment. Commission is calculated as a percentage of the lesson price (excluding the platform processing fee).</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>11.1. Commission rates are as set out in clause 10 above and may vary by subscription tier.</li>
                <li>11.2. An additional new student bonus commission applies to the first booking with each new client (BASIC: 8%, PRO/STUDIO: 10%, BUSINESS: 12%). This is in addition to the standard commission rate.</li>
                <li>11.3. Commission rates may be adjusted by DriveBook with 30 days written notice. Changes apply to new bookings created after the effective date.</li>
                <li>11.4. Commission is deducted automatically at the time of payment processing. The Instructor's payout is the lesson price minus commission.</li>
                <li>11.5. DriveBook may also charge a platform processing fee (currently 3.6%) on each transaction. This fee is separate from commission and is charged to the learner.</li>
              </ul>

              <h3 id="payouts" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Payout Terms</h3>
              <p className="mb-2">12. DriveBook processes instructor payouts on a weekly basis (typically Fridays) for all lessons completed and settled in the preceding week.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>12.1. To receive payouts, the Instructor must provide valid Australian bank account details (BSB and account number) or connect a Stripe account via Stripe Connect.</li>
                <li>12.2. DriveBook validates BSB format but cannot guarantee the accuracy of account details provided. The Instructor is responsible for providing correct banking information. DriveBook is not liable for misdirected payments caused by incorrect details.</li>
                <li>12.3. If the Instructor has not provided a valid ABN, DriveBook is required by the Australian Taxation Office to withhold 47% of gross payments (no-ABN withholding). This withholding is remitted to the ATO on the Instructor's behalf.</li>
                <li>12.4. DriveBook may hold or delay payouts where: (a) a dispute is active involving the relevant booking; (b) the Instructor's account is under review; or (c) required by law or regulatory authority.</li>
                <li>12.5. Payouts are in Australian Dollars (AUD). International transfers are not supported.</li>
                <li>12.6. A lesson is eligible for payout once it has been completed (checked out) and the transaction status is SETTLED.</li>
              </ul>

              <h3 id="platform-guard" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Platform Client Guard</h3>
              <p className="mb-2">13. The Instructor agrees not to solicit, encourage, or accept payment from learners outside the DriveBook platform where those learners were acquired through DriveBook.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>13.1. A learner is considered "platform-acquired" if they first contacted the Instructor through DriveBook, booked a lesson through DriveBook, or have an active DriveBook account linked to the Instructor.</li>
                <li>13.2. Offline/cash bookings (available on PRO and above) are permitted only for pre-existing students who were not acquired through DriveBook and do not have a DriveBook account linked to the Instructor.</li>
                <li>13.3. Attempting to route platform-acquired students to cash or offline arrangements is a material breach of this Agreement and may result in immediate account suspension and recovery of commissions owed.</li>
                <li>13.4. DriveBook monitors for circumvention and may investigate complaints from learners or patterns of unusual activity.</li>
              </ul>

              <h3 id="documents" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Document Obligations</h3>
              <p className="mb-2">14. The Instructor must upload and maintain current copies of all required compliance documents on the DriveBook platform.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>14.1. Required documents include: instructor accreditation, public liability insurance certificate, WWCC, and national police clearance.</li>
                <li>14.2. DriveBook will send email reminders when documents are approaching expiry (90, 30, and 7 days before expiry).</li>
                <li>14.3. If a required document expires and is not renewed, DriveBook may suspend the Instructor's account until the renewed document is uploaded and verified.</li>
                <li>14.4. DriveBook may verify documents with the issuing authority. The Instructor consents to such verification.</li>
                <li>14.5. Uploading false, altered, or expired documents is a material breach of this Agreement and may result in immediate termination and referral to relevant authorities.</li>
              </ul>

              <h3 id="conduct" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Conduct Standards</h3>
              <p className="mb-2">15. The Instructor agrees to maintain professional standards at all times when representing DriveBook or interacting with learners through the platform.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>15.1. The Instructor must not engage in harassment, bullying, intimidation, or inappropriate behaviour toward learners, DriveBook staff, or other platform users.</li>
                <li>15.2. The Instructor must not make false or misleading claims in their profile, including about qualifications, experience, or pricing.</li>
                <li>15.3. The Instructor must not attempt to manipulate the review system, including by offering incentives for positive reviews or discouraging negative reviews.</li>
                <li>15.4. The Instructor must not use the platform to promote competing services or third-party commercial interests.</li>
                <li>15.5. The Instructor must not contact learners for purposes unrelated to the delivery of driving lessons booked through DriveBook.</li>
              </ul>

              <h3 id="cancellation" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Cancellation by Instructor</h3>
              <p className="mb-2">16. If an Instructor cancels a confirmed booking:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>16.1. The learner receives a 100% refund to their DriveBook Wallet, regardless of notice period.</li>
                <li>16.2. The Instructor receives no payment for the cancelled lesson.</li>
                <li>16.3. Repeated cancellations (3 or more in any 30-day period) may result in account suspension, reduced visibility in search results, or termination at DriveBook's discretion.</li>
                <li>16.4. Where possible, the Instructor should provide at least 24 hours notice of cancellation and offer to reschedule.</li>
                <li>16.5. Emergency cancellations (illness, accident, vehicle breakdown) will be considered on a case-by-case basis. The Instructor should contact DriveBook support promptly.</li>
              </ul>

              <h3 id="data-access" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Data Access After Subscription Ends</h3>
              <p className="mb-2">17. If an Instructor's subscription expires, is cancelled, or enters a past-due state:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>17.1. The Instructor retains read-only access to all their historical data, including booking history, client records, earnings reports, and documents. This access is retained indefinitely and is not contingent on an active subscription.</li>
                <li>17.2. Write access — including creating new bookings, adding new clients, and modifying settings — is suspended until the subscription is reactivated.</li>
                <li>17.3. The Instructor's public booking page is taken offline and they are removed from public search results while the subscription is inactive.</li>
                <li>17.4. Existing confirmed bookings are not affected by subscription expiry. The Instructor may still check in, complete, and receive payment for bookings that were confirmed before expiry.</li>
                <li>17.5. Data is not deleted on subscription expiry. See Account Closure (clause 18) for data deletion terms.</li>
              </ul>

              <h3 id="account-closure" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Account Closure</h3>
              <p className="mb-2">18. The Instructor may close their account at any time by contacting DriveBook support.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>18.1. Upon account closure, personal data will be deleted or anonymised within 30 days, except where retention is required by law.</li>
                <li>18.2. Booking and transaction records are retained for 7 years for tax and financial compliance purposes.</li>
                <li>18.3. Any outstanding payouts will be processed before account closure. Payouts cannot be processed after account closure.</li>
                <li>18.4. Subscription fees are not refunded upon account closure.</li>
                <li>18.5. DriveBook may close an Instructor's account for any reason set out in the Events of Termination (clause 22).</li>
              </ul>

              <h3 id="ip" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Intellectual Property</h3>
              <p className="mb-2">19. All intellectual property in the DriveBook platform, including software, design, trademarks, and content created by DriveBook, is owned exclusively by DriveBook Pty Ltd.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>19.1. The Instructor retains ownership of content they create and upload to the platform (profile text, photos, etc.).</li>
                <li>19.2. By uploading content, the Instructor grants DriveBook a non-exclusive, royalty-free, worldwide licence to display, reproduce, and use that content for the purpose of operating and promoting the platform.</li>
                <li>19.3. This licence survives account closure for the purpose of displaying historical reviews and anonymised data.</li>
              </ul>

              <h3 id="confidentiality" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Confidentiality</h3>
              <p className="mb-2">20. The Instructor agrees to keep confidential any non-public information about DriveBook's operations, including:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>20.1. commission rates, pricing algorithms, and fee structures;</li>
                <li>20.2. internal processes, systems, and technology;</li>
                <li>20.3. other instructors' personal or business information; and</li>
                <li>20.4. any information marked as confidential or that a reasonable person would understand to be confidential.</li>
              </ul>
              <p className="mb-4">20.5. This obligation survives termination of this Agreement for a period of 2 years.</p>

              <h3 id="liability" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Warranty and Limitation of Liability</h3>
              <p className="mb-2">21. DriveBook provides the platform "as is" and makes no warranty that it will be uninterrupted, error-free, or meet the Instructor's specific requirements.</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>21.1. To the maximum extent permitted by law, DriveBook's total aggregate liability to the Instructor is limited to the total subscription fees paid by the Instructor in the 3 months immediately preceding the event giving rise to the claim.</li>
                <li>21.2. DriveBook is not liable for: loss of earnings, loss of clients, loss of data, or any indirect or consequential loss arising from use of the platform.</li>
                <li>21.3. The Instructor indemnifies DriveBook against any claims, damages, losses, or expenses (including legal costs) arising from: (a) the Instructor's breach of this Agreement; (b) the Instructor's negligence or misconduct; (c) any claim by a learner arising from the Instructor's delivery of driving lessons; or (d) the Instructor's failure to maintain required credentials or insurance.</li>
                <li>21.4. This indemnity survives termination of this Agreement.</li>
              </ul>

              <h3 id="termination" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Events of Termination</h3>
              <p className="mb-2">22. DriveBook may restrict, suspend, or terminate an Instructor's account immediately where:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>22.1. the Instructor breaches any term of this Agreement;</li>
                <li>22.2. the Instructor's accreditation, insurance, WWCC, or police check expires or is cancelled;</li>
                <li>22.3. the Instructor is charged with or convicted of a criminal offence;</li>
                <li>22.4. the Instructor engages in repeated cancellations, misconduct, or platform manipulation;</li>
                <li>22.5. the Instructor attempts to circumvent the platform client guard;</li>
                <li>22.6. the Instructor provides false or misleading information;</li>
                <li>22.7. the Instructor's subscription payment fails and is not resolved within 14 days; or</li>
                <li>22.8. in any other circumstances at DriveBook's sole discretion.</li>
              </ul>
              <p className="mb-4">22.9. The Instructor may terminate this Agreement by closing their account at any time, subject to clause 18.</p>

              <h3 id="disputes" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Dispute Resolution</h3>
              <p className="mb-2">23. If a dispute arises between the Instructor and DriveBook:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>23.1. the parties will first attempt to resolve the dispute directly within 14 days of written notice;</li>
                <li>23.2. if unresolved, the parties agree to refer the matter to a mediator, with costs shared equally; and</li>
                <li>23.3. if mediation fails, the matter may be referred to arbitration under the Rules of the Resolution Institute, with the arbitrator's decision binding on both parties.</li>
              </ul>

              <h3 id="modification" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Modification of Agreement</h3>
              <p className="mb-4">24. DriveBook may change this Agreement from time to time with 30 days written notice to the Instructor. An Instructor who continues to use the platform after the notice period is considered to have accepted the updated terms.</p>

              <h3 id="governing-law" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Governing Law</h3>
              <p className="mb-4">25. This Agreement is governed by the laws of Western Australia. The parties submit to the non-exclusive jurisdiction of the courts of Western Australia.</p>

              <h3 className="font-semibold text-gray-900 mb-2">Entire Agreement</h3>
              <p className="mb-4">26. This Agreement, together with the <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link> and any other documents referred to herein, represents the entire agreement between the parties and supersedes any previous understandings or agreements.</p>

              <h3 className="font-semibold text-gray-900 mb-2">Severability</h3>
              <p className="mb-4">27. If any provision of this Agreement is found to be invalid or unenforceable, that provision will be severed. The remaining provisions continue in full force and effect.</p>

              <h3 className="font-semibold text-gray-900 mb-2">Waiver</h3>
              <p className="mb-4">28. A failure by DriveBook to exercise any right under this Agreement does not constitute a waiver of that right.</p>

              <h3 className="font-semibold text-gray-900 mb-2">Assignment</h3>
              <p className="mb-2">29. DriveBook may assign this Agreement to any related body corporate or successor entity without the Instructor's consent.</p>
              <p className="mb-4">29.1. The Instructor may not assign their rights or obligations under this Agreement without DriveBook's prior written consent.</p>

            </section>

            <section id="definitions" className="mb-8 bg-gray-50 rounded-xl p-6 scroll-mt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Definitions</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="font-semibold inline">ABN</dt><dd className="inline"> — Australian Business Number issued by the Australian Business Register.</dd></div>
                <div><dt className="font-semibold inline">Agreement</dt><dd className="inline"> — this document as amended from time to time, together with any documents referred to herein.</dd></div>
                <div><dt className="font-semibold inline">Commission</dt><dd className="inline"> — the percentage of each lesson payment deducted by DriveBook as set out in clause 11.</dd></div>
                <div><dt className="font-semibold inline">DriveBook</dt><dd className="inline"> — DriveBook Pty Ltd (ABN: [Your ABN]).</dd></div>
                <div><dt className="font-semibold inline">Event of Termination</dt><dd className="inline"> — those events set out in clause 22.</dd></div>
                <div><dt className="font-semibold inline">Instructor</dt><dd className="inline"> — a person who has registered on the DriveBook platform to provide driving instruction services as an independent contractor.</dd></div>
                <div><dt className="font-semibold inline">Platform</dt><dd className="inline"> — the DriveBook software platform, website, and associated services at drivebook.com.au.</dd></div>
                <div><dt className="font-semibold inline">Platform-Acquired Client</dt><dd className="inline"> — a learner who first contacted the Instructor through DriveBook or has a DriveBook account linked to the Instructor.</dd></div>
                <div><dt className="font-semibold inline">Subscription</dt><dd className="inline"> — the recurring fee paid by the Instructor for access to the DriveBook platform, as described in clause 10.</dd></div>
                <div><dt className="font-semibold inline">Written Notice</dt><dd className="inline"> — notification given by email, SMS, or via the DriveBook platform.</dd></div>
                <div><dt className="font-semibold inline">WWCC</dt><dd className="inline"> — Working With Children Check or equivalent issued by the relevant state or territory authority.</dd></div>
              </dl>
            </section>

          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
            <Link href="/terms" className="text-purple-600 hover:underline">Learner Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>
            <span>·</span>
            <Link href="/contact" className="text-purple-600 hover:underline">Contact Us</Link>
            <span>·</span>
            <Link href="/" className="text-purple-600 hover:underline">Back to Home</Link>
          </div>
        </main>
      </div>

      <footer className="bg-gray-800 text-white py-8 px-4 mt-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} DriveBook Pty Ltd. All rights reserved.
      </footer>
    </div>
  )
}
