import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe, CheckCircle, XCircle, ChevronRight, Zap, Star, Shield } from 'lucide-react'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

export const metadata: Metadata = {
  title: 'Custom Domain for Driving Instructors — Your Own Website in Minutes',
  description:
    'Connect your own domain to DriveBook and give students a professional booking website at your own web address. No website builder. No developer. Ready in under 30 minutes.',
  openGraph: {
    title: 'Custom Domain for Driving Instructors | DriveBook',
    description: 'Point your own domain to DriveBook. Get a professional booking website at your own web address — no developer required.',
    url: `${BASE_URL}/features/custom-domain`,
  },
  alternates: { canonical: `${BASE_URL}/features/custom-domain` },
}

function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="no-underline"><Logo size={34} dark /></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/for-instructors" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">For Instructors</Link>
          <Link href="/platform" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Platform</Link>
          <Link href="/blog" className="text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors no-underline">Blog</Link>
          <Link href="/teach-with-drivebook" className="ml-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm no-underline hover:from-indigo-500 hover:to-blue-500 transition-all">
            Start Free Trial
          </Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-10 mt-16 text-center text-white/40 text-sm">
      <p>© {new Date().getFullYear()} DriveBook · <Link href="/privacy" className="hover:text-white/60 no-underline">Privacy</Link> · <Link href="/terms" className="hover:text-white/60 no-underline">Terms</Link></p>
    </footer>
  )
}

export default function CustomDomainPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${BASE_URL}/features` },
      { '@type': 'ListItem', position: 3, name: 'Custom Domain', item: `${BASE_URL}/features/custom-domain` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Do I need to buy a domain first?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. You purchase the domain from any registrar (GoDaddy, Namecheap, Google Domains, etc.), then configure it to point to DriveBook using a CNAME record. DriveBook provides step-by-step instructions.' } },
      { '@type': 'Question', name: 'How long does setup take?', acceptedAnswer: { '@type': 'Answer', text: 'DNS configuration takes under 10 minutes. DNS propagation typically completes within 1–24 hours depending on your registrar. Most users are live within a few hours.' } },
      { '@type': 'Question', name: 'Can I use a .com.au domain?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Any domain works — .com.au, .com, .net, .au, or any other TLD. A .com.au domain provides the strongest local trust signal for Australian students.' } },
      { '@type': 'Question', name: 'Is SSL included?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. HTTPS is automatically provisioned for your custom domain. Students see a secure padlock in their browser at no extra cost to you.' } },
      { '@type': 'Question', name: 'What happens to my DriveBook subdomain when I add a custom domain?', acceptedAnswer: { '@type': 'Answer', text: 'Both work simultaneously. Your DriveBook subdomain (yourname.drivebook.com.au) continues to function. The custom domain is an additional access point to your booking page.' } },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-950 py-20 md:py-28 px-4">
          <div className="absolute top-0 right-1/3 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="max-w-4xl mx-auto">
            <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
              <Link href="/" className="hover:text-white no-underline">Home</Link>
              <span>/</span>
              <Link href="/for-instructors" className="hover:text-white no-underline">For Instructors</Link>
              <span>/</span>
              <span className="text-white/60">Custom Domain</span>
            </nav>
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-6">
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">Available on PRO and above</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your Own Driving School<br />
              <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">Website — Without Building One</span>
            </h1>
            <p className="text-xl text-white/70 mb-8 max-w-2xl leading-relaxed">
              Connect your own domain to DriveBook and give your driving school a professional web presence at your own address — like <span className="text-white font-semibold">perthdriving.com.au</span>. No website builder. No developer. No maintenance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/teach-with-drivebook" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-8 py-4 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-indigo-500/20 text-center">
                Start Free Trial →
              </Link>
              <Link href="/blog/connecting-your-custom-domain-drivebook" className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-semibold no-underline transition-all border border-white/10 text-center">
                Setup Guide
              </Link>
            </div>
          </div>
        </section>

        {/* What it is */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Your brand. Your domain. DriveBook's engine.</h2>
              <p className="text-white/60 leading-relaxed mb-4">
                Every DriveBook instructor already has a booking page at <span className="text-white">yourname.drivebook.com.au</span>. That's a good start.
              </p>
              <p className="text-white/60 leading-relaxed mb-4">
                With a custom domain, the same professional booking page — with your logo, brand colours, real-time availability, and online booking — lives at <span className="text-white">yourownname.com.au</span>.
              </p>
              <p className="text-white/60 leading-relaxed">
                Students who see your card, your car, or your Google ad land on a website that looks like yours — not a third-party platform. That trust matters.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { before: 'yourname.drivebook.com.au', after: 'perthdriving.com.au', label: 'Driving school' },
                { before: 'sarah-jones.drivebook.com.au', after: 'sarahjonesdriving.com.au', label: 'Solo instructor' },
                { before: 'northsidedriving.drivebook.com.au', after: 'northsidedriving.com.au', label: 'Named school' },
              ].map(({ before, after, label }) => (
                <div key={before} className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
                  <p className="text-white/40 text-xs mb-2">{label}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/40 text-xs line-through truncate">{before}</p>
                      <p className="text-emerald-400 font-semibold text-sm truncate">{after}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Setup steps */}
        <section className="bg-white/[0.02] border-y border-white/10 py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-3">Setup in 3 Steps</h2>
            <p className="text-white/50 text-center mb-10 text-sm">Takes under 30 minutes. No technical knowledge required.</p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: '1', title: 'Buy a domain', desc: 'Purchase your domain from any registrar — GoDaddy, Namecheap, Google Domains, or any Australian domain provider. A .com.au domain costs around $20/year.', icon: Globe, colour: 'from-indigo-600 to-blue-600' },
                { n: '2', title: 'Add a CNAME record', desc: 'In your domain registrar\'s DNS settings, add a CNAME record pointing to DriveBook. DriveBook\'s dashboard provides the exact record to copy — no guesswork.', icon: Zap, colour: 'from-violet-600 to-indigo-600' },
                { n: '3', title: 'Enter your domain in DriveBook', desc: 'Go to Dashboard → Branding → Custom Domain. Enter your domain. DriveBook verifies it automatically. DNS propagates within 1–24 hours. Done.', icon: CheckCircle, colour: 'from-emerald-600 to-teal-600' },
              ].map(({ n, title, desc, icon: Icon, colour }) => (
                <div key={n} className="relative bg-white/[0.04] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colour} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute top-4 right-4 text-4xl font-black text-white/[0.06]">{n}</div>
                  <h3 className="font-bold text-white mb-2">{title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Why It Matters</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: Star, title: 'Trust and credibility', desc: 'Students searching Google and seeing "perthdriving.com.au" trust that result more than a generic subdomain. Your own domain signals an established, professional business.' },
              { icon: Shield, title: 'Google indexes your domain', desc: 'When DriveBook\'s structured data and content sit at your own domain, the SEO value accumulates to your brand — not to drivebook.com.au.' },
              { icon: Globe, title: 'Works on your business cards', desc: 'Your domain on a car magnet, a flyer, or a business card looks professional. A subdomain doesn\'t.' },
              { icon: Zap, title: 'SSL included automatically', desc: 'HTTPS is provisioned automatically. Students always see a secure padlock. No SSL certificate purchase needed.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{title}</p>
                  <p className="text-white/55 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section className="max-w-4xl mx-auto px-4 pb-12">
          <h2 className="text-3xl font-bold text-white mb-3 text-center">Custom Domain vs DriveBook Subdomain vs Social Media</h2>
          <p className="text-white/50 text-center text-sm mb-10">Three options — very different results for your brand.</p>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left p-4 text-white/60 font-semibold">Feature</th>
                  <th className="text-center p-4 text-indigo-400 font-bold">Custom Domain</th>
                  <th className="text-center p-4 text-white/60 font-semibold">DriveBook Subdomain</th>
                  <th className="text-center p-4 text-white/50 font-semibold">Social Media Page</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { f: 'Your own web address', custom: true, sub: false, social: false },
                  { f: 'Online booking', custom: true, sub: true, social: false },
                  { f: 'Professional credibility', custom: true, sub: 'partial', social: 'partial' },
                  { f: 'Google indexes your brand', custom: true, sub: false, social: false },
                  { f: 'SSL (HTTPS)', custom: true, sub: true, social: true },
                  { f: 'No setup cost beyond domain', custom: true, sub: true, social: true },
                  { f: 'Works on print/physical materials', custom: true, sub: 'partial', social: false },
                ].map(({ f, custom, sub, social }) => {
                  const Cell = ({ val }: { val: boolean | string }) =>
                    val === true ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> :
                    val === false ? <XCircle className="h-5 w-5 text-red-400/60 mx-auto" /> :
                    <span className="text-yellow-400 text-xs font-semibold">Partial</span>
                  return (
                    <tr key={f} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                      <td className="p-4 text-white/80">{f}</td>
                      <td className="p-4 text-center"><Cell val={custom} /></td>
                      <td className="p-4 text-center"><Cell val={sub} /></td>
                      <td className="p-4 text-center"><Cell val={social} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Common Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Do I need to buy a domain first?', a: 'Yes. Purchase from any registrar (GoDaddy, Namecheap, Google Domains, etc.), then configure it in DriveBook using a CNAME record.' },
              { q: 'How long does setup take?', a: 'DNS configuration takes under 10 minutes. DNS propagation typically completes within 1–24 hours. Most users are live the same day.' },
              { q: 'Can I use a .com.au domain?', a: 'Yes. Any domain works — .com.au, .com, .net, .au. A .com.au provides the strongest Australian trust signal.' },
              { q: 'Is SSL included?', a: 'Yes. HTTPS is automatically provisioned for your custom domain at no extra cost.' },
              { q: 'What happens to my DriveBook subdomain?', a: 'Both work simultaneously. Your subdomain continues to function. The custom domain is an additional access point.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-white/[0.04] border border-white/10 rounded-xl p-5">
                <p className="font-semibold text-white mb-2 text-sm">{q}</p>
                <p className="text-white/60 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related */}
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <h2 className="text-lg font-bold text-white mb-4">Related Reading</h2>
          <div className="space-y-2">
            {[
              { href: '/blog/connecting-your-custom-domain-drivebook', label: 'How to connect your custom domain to DriveBook' },
              { href: '/blog/custom-domain-vs-social-media-which-builds-more-trust', label: 'Custom domain vs social media — which builds more trust?' },
              { href: '/blog/drivebook-custom-domain-branding-driving-instructors', label: 'Your own driving school website — without building one' },
              { href: '/blog/why-every-driving-instructor-needs-their-own-booking-website', label: 'Why every driving instructor needs their own booking website' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all no-underline group">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{label}</span>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-indigo-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-900/60 to-blue-900/60 border border-indigo-500/30 p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Own Your Online Presence</h2>
            <p className="text-white/60 mb-6 text-sm max-w-md mx-auto">Custom domain is included in DriveBook PRO. Start your free trial, then connect your domain in under 30 minutes.</p>
            <Link href="/teach-with-drivebook" className="inline-block bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-10 py-3.5 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-indigo-500/20">
              Start Free Trial →
            </Link>
            <p className="text-white/30 text-xs mt-4">No credit card required · Full PRO features during trial</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
