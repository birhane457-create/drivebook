import Link from 'next/link'
import TermsTOC from '@/components/TermsTOC'
import Logo from '@/components/Logo'

export const metadata = {
  title: 'Terms of Service | DriveBook',
  description: 'DriveBook Terms of Service — the rules governing use of the platform for learners and instructors.',
}

export default function TermsPage() {
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

      <div className="max-w-6xl mx-auto px-4 py-16 flex gap-12">
        <TermsTOC />

        <main className="flex-1 min-w-0">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              For Learners / Students Only
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Learner Terms and Conditions</h1>
            <p className="text-gray-500 text-sm">Last updated: May 2026 · Version 1.1</p>
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
              These terms apply to <strong>Learners</strong> booking driving lessons through DriveBook. If you are a driving instructor, please read our <Link href="/instructor-terms" className="underline font-medium">Instructor Terms and Conditions</Link> instead.
            </div>
          </div>

          <div className="space-y-2 text-gray-700 leading-relaxed">

            <section id="parties" className="mb-8 scroll-mt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Parties</h2>
              <p>This Agreement is between:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>DriveBook</strong> (operated by DriveBook Pty Ltd, ABN: [Your ABN]); and</li>
                <li>the <strong>Learner</strong> who has signed up to the DriveBook platform in accordance with these Terms and Conditions.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">OPERATIVE PROVISIONS</h2>

              <h3 id="term-of-agreement" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Term of Agreement</h3>
              <p className="mb-4">1. This Agreement commences on the day the Learner accepts this Agreement digitally and terminates when an Event of Termination takes place.</p>

              <h3 id="capacity" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Capacity</h3>
              <p className="mb-2">2. The Learner warrants and agrees that they hold a current and valid Learner's Permit, or any other driver's licence type that legally allows them to drive in the state or territory in which they are undertaking driving instruction.</p>
              <p className="mb-4">3. This Agreement automatically terminates if a Learner ceases to hold, or is found not to hold, a valid current Learner's Permit or other licence that lawfully allows them to drive. This is an essential term.</p>

              <h3 id="relationship" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Relationship of the Parties</h3>
              <p className="mb-2">4. The Learner acknowledges and agrees that:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>4.1. they are directly engaging a Driving Instructor who is at all times acting as an independent contractor;</li>
                <li>4.2. DriveBook is the conduit between Driving Instructors and Learners;</li>
                <li>4.3. any agreement to undertake driving lessons is between the Learner and the independent Driving Instructor, to which DriveBook is not a party;</li>
                <li>4.4. the Driving Instructor is independent of DriveBook and is not an agent, employee, contractor or subcontractor of DriveBook; and</li>
                <li>4.5. DriveBook is not responsible or liable for any physical, mental or emotional loss, claim, harm or damage suffered as a result of, or in connection with, booking or attending a lesson with a Driving Instructor.</li>
              </ul>

              <h3 id="services" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Description of Services</h3>
              <p className="mb-2">5. A Learner may use the DriveBook platform to:</p>
              <ul className="list-none pl-6 space-y-1 mb-2">
                <li>5.1. browse and compare Driving Instructors by experience, price, vehicle, availability, ratings, and location; and</li>
                <li>5.2. book and pay for driving lessons online.</li>
              </ul>
              <p className="mb-4">6. DriveBook may add, change, or remove products and services from the platform at any time.</p>

              <h3 id="agreement-by-learner" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Agreement by Learner</h3>
              <p className="mb-2">7. The Learner warrants that they have read, understood, and consent to be bound by this Agreement.</p>
              <p className="mb-2">8. If you are the parent or guardian of a Learner aged 17 years or younger, you are the financial guarantor of the Learner and this Agreement binds you and the Learner jointly and severally.</p>
              <p className="mb-4">9. You must be at least 16 years old to create an account.</p>

              <h3 id="platform-use" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Learner's Use of the Platform</h3>
              <p className="mb-2">10. The Learner agrees to:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>10.1. use only their own username and password to access the platform;</li>
                <li>10.2. not divulge their login credentials to any other person;</li>
                <li>10.3. only use the platform for its intended purpose of connecting with Driving Instructors;</li>
                <li>10.4. ensure all information provided is current, true, and correct;</li>
                <li>10.5. not use the platform for any unlawful purpose, hate speech, or to promote third-party commercial interests;</li>
                <li>10.6. not attempt to access other users' accounts or data; and</li>
                <li>10.7. not interrupt or attempt to interfere with the operation of the platform.</li>
              </ul>

              <h3 id="lessons" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Lessons</h3>
              <p className="mb-2">11. The Learner agrees to:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>11.1. arrive punctually at lessons;</li>
                <li>11.2. follow all reasonable instructions of the Driving Instructor;</li>
                <li>11.3. provide a full and valid pick-up address;</li>
                <li>11.4. provide a mobile phone number contactable via SMS and calls;</li>
                <li>11.5. abide by all driving laws, rules, and regulations in their jurisdiction;</li>
                <li>11.6. be respectful to Driving Instructors;</li>
                <li>11.7. not use a mobile phone or electronic device while undertaking lessons; and</li>
                <li>11.8. not arrange or accept an offer to undertake lessons with a Driving Instructor outside of, or separate from, the DriveBook platform. Any attempt to circumvent the platform may result in immediate account termination.</li>
              </ul>

              <h3 id="payment" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Payment Terms</h3>
              <p className="mb-2">12. Payment is required at the time of booking. Lessons are not confirmed until payment is received.</p>
              <p className="mb-2">13. All prices are in Australian Dollars (AUD) and include GST where applicable.</p>
              <p className="mb-2">14. All payments are processed securely through Stripe. By using the platform, you also agree to <a href="https://stripe.com/au/legal" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Stripe's Terms of Service</a>.</p>
              <p className="mb-2">15. When a Learner pays for a booking, a credit is issued to that Learner's DriveBook Wallet for the value of the booking. These credits:</p>
              <ul className="list-none pl-6 space-y-1 mb-4">
                <li>15.1. are non-transferable and may not be used by any other person;</li>
                <li>15.2. expire after 12 months of account inactivity, after which they are forfeited to DriveBook; and</li>
                <li>15.3. may be refunded to the original payment method upon request, subject to the Refund Policy below.</li>
              </ul>

              <h3 id="cancellation" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Cancellation and Refund Policy</h3>
              <p className="mb-3">16. The following refund tiers apply to all Learner cancellations:</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border border-gray-200 rounded-lg text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700 border-b">Notice Given</th>
                      <th className="text-left p-3 font-semibold text-gray-700 border-b">Refund to Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3">48 hours or more before lesson</td>
                      <td className="p-3 text-green-700 font-medium">100%</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">24–48 hours before lesson</td>
                      <td className="p-3 text-amber-700 font-medium">50%</td>
                    </tr>
                    <tr>
                      <td className="p-3">Less than 24 hours / no-show</td>
                      <td className="p-3 text-red-700 font-medium">0% — Instructor receives full payment</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mb-2">17. Refunds are credited to the Learner's DriveBook Wallet immediately. Withdrawal to the original payment method is available on request (minimum $10.00, processing time 5–7 business days).</p>
              <p className="mb-2">18. No-shows are treated as same-day cancellations. The Instructor receives full payment.</p>
              <p className="mb-4">19. If a Driving Instructor cancels a lesson, the Learner receives a 100% refund to their wallet regardless of notice period.</p>

              <h3 id="rescheduling" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Rescheduling Policy</h3>
              <p className="mb-2">19A. A Learner may request to reschedule a confirmed booking subject to the following conditions:</p>
              <ul className="list-none pl-6 space-y-2 mb-4">
                <li>19A.1. Rescheduling requests must be made at least 12 hours before the original lesson start time. Requests made within 12 hours of the lesson are not permitted — the Learner must cancel instead, subject to the Cancellation and Refund Policy above.</li>
                <li>19A.2. Rescheduling is subject to the Driving Instructor's availability and must be confirmed through the DriveBook platform.</li>
                <li>19A.3. The original booking time is recorded and retained by DriveBook for audit and dispute resolution purposes. The cancellation refund tier (clause 16) is calculated against the <strong>original</strong> booking time, not the rescheduled time.</li>
                <li>19A.4. If a Learner reschedules and subsequently cancels, the refund entitlement is assessed from the original lesson time, not the rescheduled time.</li>
                <li>19A.5. If a Driving Instructor reschedules a booking within 24 hours of the original lesson time, the booking is marked non-refundable. If the Learner then cancels, no refund is issued regardless of the new lesson date.</li>
                <li>19A.6. DriveBook records a full reschedule history for every booking, including who initiated each change and when.</li>
              </ul>

              <h3 id="wallet" className="font-semibold text-gray-900 mb-2 scroll-mt-8">DriveBook Wallet</h3>
              <p className="mb-2">20. The DriveBook Wallet is a prepaid credit system. It is not a bank account and is not covered by the Financial Claims Scheme.</p>
              <p className="mb-2">21. Wallet credits expire after 12 months of account inactivity. DriveBook will notify you by email 30 days and 7 days before expiry.</p>
              <p className="mb-4">22. Upon account closure, unused wallet balance will be refunded to the original payment method (minimum $10.00).</p>

              <h3 id="warranty" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Warranty</h3>
              <p className="mb-2">23. DriveBook's services come with guarantees under the Australian Consumer Law that cannot be excluded. DriveBook guarantees its services will be rendered with due care and skill and be fit for purpose.</p>
              <p className="mb-4">24. To the maximum extent permitted by law, DriveBook's liability to the Learner is limited to the re-supply of its services or payment of the cost of having those services supplied again.</p>

              <h3 id="termination" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Events of Termination</h3>
              <p className="mb-2">25. DriveBook may restrict, suspend, or cancel a Learner's account immediately where:</p>
              <ul className="list-none pl-6 space-y-1 mb-4">
                <li>25.1. the Learner breaches this Agreement;</li>
                <li>25.2. the Learner has an active payment dispute via their payment provider;</li>
                <li>25.3. the Learner has been charged with or convicted of a criminal offence;</li>
                <li>25.4. the Learner is no longer a licensed driver; or</li>
                <li>25.5. in any other circumstances at DriveBook's sole discretion.</li>
              </ul>
              <p className="mb-4">26. The Learner may terminate this Agreement by de-registering their account at any time.</p>

              <h3 id="indemnity" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Indemnity</h3>
              <p className="mb-4">27. The Learner agrees to indemnify and protect DriveBook against any actions, damages, claims, or demands (including through negligence) which occur as a result of or in relation to their actions or omissions. This clause survives termination of this Agreement.</p>

              <h3 id="privacy" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Privacy</h3>
              <p className="mb-2">28. DriveBook adheres to the Australian Privacy Principles. The <Link href="/privacy" className="text-purple-600 hover:underline">DriveBook Privacy Policy</Link> forms part of this Agreement.</p>
              <p className="mb-4">29. The Learner agrees that DriveBook may collect and use their information for the provision of services and, where consent is given, for marketing purposes.</p>

              <h3 id="ip" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Intellectual Property</h3>
              <p className="mb-4">30. All intellectual property and copyright in connection with DriveBook products and resources is owned exclusively by DriveBook Pty Ltd.</p>

              <h3 id="force-majeure" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Force Majeure</h3>
              <p className="mb-4">31. Neither party is liable to the other for failure to perform obligations caused by events beyond their reasonable control (including natural disasters, government actions, or infrastructure failures). In such events, reasonable measures will be taken to accommodate an equivalent booking for a future date.</p>

              <h3 id="disputes" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Dispute Resolution</h3>
              <p className="mb-2">32. If a dispute arises between a Learner and DriveBook:</p>
              <ul className="list-none pl-6 space-y-1 mb-4">
                <li>32.1. the parties will first attempt to resolve the dispute directly within 14 days;</li>
                <li>32.2. if unresolved, the parties agree to refer the matter to a mediator, with costs shared equally; and</li>
                <li>32.3. if mediation fails, the matter may be referred to arbitration under the Rules of the Resolution Institute, with the arbitrator's decision binding on both parties.</li>
              </ul>

              <h3 id="modification" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Modification of Agreement</h3>
              <p className="mb-4">33. DriveBook may change this Agreement from time to time with notice to the Learner. A Learner who continues to use the platform after receiving notice is considered to have accepted the updated terms.</p>

              <h3 id="governing-law" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Governing Law</h3>
              <p className="mb-4">34. This Agreement is governed by the laws of Western Australia. The parties submit to the non-exclusive jurisdiction of the courts of Western Australia.</p>

              <h3 id="entire-agreement" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Entire Agreement</h3>
              <p className="mb-4">35. This Agreement, together with the Privacy Policy and any other documents referred to herein, represents the entire agreement between the parties and supersedes any previous understandings or agreements.</p>

              <h3 id="liability" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Limitation of Liability</h3>
              <p className="mb-2">36. To the maximum extent permitted by law, DriveBook's total aggregate liability to the Learner arising out of or in connection with this Agreement (whether in contract, tort, statute, or otherwise) is limited to the total amount paid by the Learner to DriveBook in the three (3) months immediately preceding the event giving rise to the claim.</p>
              <p className="mb-4">36.1. This limitation applies regardless of the form of action and whether DriveBook has been advised of the possibility of such damages.</p>

              <h3 id="content" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Content</h3>
              <p className="mb-4">37. DriveBook reserves the right to remove, edit, or refuse any content submitted by a Learner (including reviews, messages, or profile information) at its sole discretion, without notice and without liability.</p>

              <h3 id="no-agency" className="font-semibold text-gray-900 mb-2 scroll-mt-8">No Agency</h3>
              <p className="mb-4">38. Nothing in this Agreement creates a partnership, employment relationship, joint venture, or agency between the Learner and DriveBook. The Learner has no authority to bind DriveBook in any way.</p>

              <h3 id="waiver" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Waiver</h3>
              <p className="mb-4">39. A failure or delay by DriveBook to exercise any right or remedy under this Agreement does not constitute a waiver of that right or remedy. A waiver of any breach does not constitute a waiver of any subsequent breach.</p>

              <h3 id="severability" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Severability</h3>
              <p className="mb-4">40. If any provision of this Agreement is found to be invalid, unlawful, or unenforceable, that provision will be severed from the Agreement. The remaining provisions will continue in full force and effect.</p>

              <h3 id="assignment" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Assignment</h3>
              <p className="mb-2">41. DriveBook may assign, transfer, or novate its rights and obligations under this Agreement to any related body corporate or successor entity without the Learner's consent.</p>
              <p className="mb-4">41.1. The Learner may not assign, transfer, or novate any of their rights or obligations under this Agreement without DriveBook's prior written consent.</p>

              <h3 id="data-retention" className="font-semibold text-gray-900 mb-2 scroll-mt-8">Data Retention</h3>
              <p className="mb-4">42. Upon account closure, DriveBook will retain the Learner's personal data for 30 days, after which it will be deleted or anonymised, unless retention is required by applicable law or regulation (including for tax, fraud prevention, or dispute resolution purposes).</p>

              <h3 id="sms" className="font-semibold text-gray-900 mb-2 scroll-mt-8">SMS Communications</h3>
              <p className="mb-2">43. By providing a mobile phone number and creating an account, the Learner consents to receive SMS messages from DriveBook relating to bookings, account activity, and platform updates.</p>
              <ul className="list-none pl-6 space-y-1 mb-4">
                <li>43.1. To opt out of SMS communications, reply <strong>STOP</strong> to any message. To request assistance, reply <strong>HELP</strong>.</li>
                <li>43.2. Message and data rates may apply depending on your mobile carrier.</li>
                <li>43.3. DriveBook's SMS communications comply with the <em>Spam Act 2003</em> (Cth).</li>
                <li>43.4. Opting out of SMS may affect your ability to receive time-sensitive booking notifications.</li>
              </ul>
            </section>

            <section id="definitions" className="mb-8 bg-gray-50 rounded-xl p-6 scroll-mt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Definitions</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="font-semibold inline">Agreement</dt><dd className="inline"> — this document as amended from time to time, together with any documents referred to herein.</dd></div>
                <div><dt className="font-semibold inline">DriveBook</dt><dd className="inline"> — DriveBook Pty Ltd (ABN: [Your ABN]).</dd></div>
                <div><dt className="font-semibold inline">Driving Instructor</dt><dd className="inline"> — an independent contractor who has registered on the DriveBook platform to provide driving instruction services.</dd></div>
                <div><dt className="font-semibold inline">Event of Termination</dt><dd className="inline"> — those events set out in clause 25.</dd></div>
                <div><dt className="font-semibold inline">Learner</dt><dd className="inline"> — a person who has created an account and made or attempted to make a booking through DriveBook.</dd></div>
                <div><dt className="font-semibold inline">Learner's Permit</dt><dd className="inline"> — a licence issued to a person who has met the requirements to drive while supervised by a qualified supervising driver.</dd></div>
                <div><dt className="font-semibold inline">Wallet</dt><dd className="inline"> — the DriveBook prepaid credit system associated with a Learner's account.</dd></div>
                <div><dt className="font-semibold inline">Written Notice</dt><dd className="inline"> — notification given by email, SMS, or via the DriveBook platform.</dd></div>
              </dl>
            </section>

          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
            <Link href="/instructor-terms" className="text-purple-600 hover:underline">Instructor Terms</Link>
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
