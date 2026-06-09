import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Warehouse, BarChart3, Brain, ShoppingCart, Factory, Truck,
  Globe2, Shield, Zap, CheckCircle2, ArrowRight, Star,
  Building2, Users, Package, CreditCard, Code2, Layers,
  ChevronRight, Play, TrendingUp, Bot
} from 'lucide-react';

const FEATURES = [
  { icon: Warehouse, label: 'Warehouse Execution', desc: 'Bin management, pick waves, license plates, putaway strategies.' },
  { icon: ShoppingCart, label: 'Point of Sale', desc: 'Multi-location POS with loyalty, offline mode, and real-time stock.' },
  { icon: Truck, label: 'Procurement', desc: 'Supplier management, PO workflow, 3-way matching, scorecards.' },
  { icon: Factory, label: 'Manufacturing', desc: 'BOM, production orders, MRP, quality control.' },
  { icon: BarChart3, label: 'Financial Suite', desc: 'AR, AP, GL, cost centres, multi-currency, tax engine.' },
  { icon: Brain, label: 'AI Forecasting', desc: 'Demand sensing, replenishment planning, anomaly detection.' },
  { icon: Bot, label: 'AI Copilot', desc: 'Natural language queries across all your operational data.' },
  { icon: Globe2, label: 'Multi-Channel Commerce', desc: 'Unified inventory across online, retail, wholesale & marketplace.' },
  { icon: Shield, label: 'Compliance & IAM', desc: 'RBAC, audit logs, SOC2 controls, compliance matrix.' },
  { icon: Zap, label: 'Workflow Automation', desc: 'Visual rule builder, event bus, scheduled jobs, webhooks.' },
  { icon: Code2, label: 'Developer Platform', desc: 'REST API, SDK, plugin marketplace, white-label ready.' },
  { icon: TrendingUp, label: 'Executive Intelligence', desc: 'Real-time KPIs, benchmarking, investor metrics, AIOps.' },
];

const INDUSTRIES = [
  { name: 'Retail & Omnichannel', icon: ShoppingCart, color: 'bg-blue-500' },
  { name: 'Wholesale & Distribution', icon: Truck, color: 'bg-purple-500' },
  { name: 'Manufacturing', icon: Factory, color: 'bg-orange-500' },
  { name: '3PL & Logistics', icon: Globe2, color: 'bg-green-500' },
  { name: 'E-Commerce', icon: Package, color: 'bg-pink-500' },
  { name: 'Enterprise SaaS', icon: Building2, color: 'bg-cyan-500' },
];

const STATS = [
  { value: '120+', label: 'Entities & modules' },
  { value: '70+', label: 'Application pages' },
  { value: '40+', label: 'Major workflows' },
  { value: '99.9%', label: 'Uptime SLA' },
];

const TESTIMONIALS = [
  { name: 'Sarah Chen', role: 'VP Operations, RetailCo', text: 'WMS Pro replaced three legacy systems. Inventory accuracy went from 87% to 99.4% in 60 days.' },
  { name: 'Marcus Webb', role: 'CTO, DistributePro', text: 'The API-first architecture meant we were integrated with our ERP in a week, not months.' },
  { name: 'Priya Nair', role: 'CFO, ManuCorp', text: 'The financial suite gave us real-time P&L by warehouse for the first time. Game changer.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Warehouse className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">WMS Pro</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#industries" className="hover:text-gray-900 transition-colors">Industries</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#about" className="hover:text-gray-900 transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="text-xs sm:text-sm px-3 sm:px-4">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 bg-gradient-to-b from-primary/5 via-white to-white">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="mb-5 sm:mb-6 bg-primary/10 text-primary border-0 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm">
            Enterprise WMS & ERP Platform
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-tight mb-5 sm:mb-6">
            The Operating System<br className="hidden sm:block" />
            {' '}<span className="text-primary">for Modern Commerce</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            WMS Pro unifies inventory, procurement, manufacturing, finance, and AI intelligence into a single multi-tenant platform — from warehouse floor to executive suite.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto px-6 sm:px-8 text-sm sm:text-base gap-2">
                Start Free 14-Day Trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/demo-script" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-6 sm:px-8 text-sm sm:text-base gap-2">
                <Play className="w-4 h-4" /> Watch Demo
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs sm:text-sm text-gray-400">No credit card required · Setup in under 5 minutes</p>
        </div>

        {/* Stats bar */}
        <div className="max-w-4xl mx-auto mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          {STATS.map(s => (
            <div key={s.label} className="text-center p-3 sm:p-4 rounded-2xl bg-white shadow-sm border border-gray-100">
              <p className="text-2xl sm:text-3xl font-black text-primary">{s.value}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14 sm:py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-3 sm:mb-4">Everything Your Business Needs</h2>
            <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">One platform, every workflow — from receiving dock to customer delivery.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map(f => {
              const FI = f.icon;
              return (
                <div key={f.label} className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow group">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <FI className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{f.label}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="py-14 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-3 sm:mb-4">Built for Your Industry</h2>
            <p className="text-base sm:text-lg text-gray-500">Purpose-built configurations for six major verticals.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {INDUSTRIES.map(ind => {
              const II = ind.icon;
              return (
                <div key={ind.name} className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className={`w-10 h-10 rounded-xl ${ind.color} flex items-center justify-center flex-shrink-0`}>
                    <II className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{ind.name}</p>
                    <p className="text-xs text-primary mt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Learn more <ChevronRight className="w-3 h-3" />
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-3 sm:mb-4">Trusted by Operations Teams</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-14 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-3 sm:mb-4">Simple, Transparent Pricing</h2>
            <p className="text-base sm:text-lg text-gray-500">Scale from startup to enterprise without re-platforming.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { name: 'Starter', price: '$299', period: '/mo', desc: 'For small teams getting started', features: ['1 location', '5 users', 'Core WMS + POS', 'Email support'], cta: 'Start Free Trial' },
              { name: 'Growth', price: '$899', period: '/mo', desc: 'For growing operations', features: ['5 locations', '25 users', 'Full platform + AI', 'Priority support', 'API access'], cta: 'Start Free Trial', popular: true },
              { name: 'Enterprise', price: 'Custom', period: '', desc: 'For complex, multi-tenant deployments', features: ['Unlimited locations', 'Unlimited users', 'White-label', 'SLA + CSM', 'Custom integrations'], cta: 'Contact Sales' },
            ].map(plan => (
              <div key={plan.name} className={`p-5 sm:p-6 rounded-2xl border-2 ${plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-gray-100'} relative`}>
                {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white border-0 px-3">Most Popular</Badge>}
                <p className="font-bold text-base sm:text-lg">{plan.name}</p>
                <p className="text-sm text-gray-500 mb-3 sm:mb-4">{plan.desc}</p>
                <div className="flex items-end gap-1 mb-4 sm:mb-6">
                  <span className="text-3xl sm:text-4xl font-black">{plan.price}</span>
                  <span className="text-gray-500 mb-1">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 bg-primary text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4">Ready to Modernise Your Operations?</h2>
          <p className="text-primary-foreground/80 text-base sm:text-lg mb-6 sm:mb-8">Join hundreds of operations teams already running on WMS Pro.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto px-6 sm:px-8 gap-2">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto px-6 sm:px-8 border-white/30 text-white hover:bg-white/10">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Warehouse className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold">WMS Pro</span>
          </div>
          <p className="text-xs sm:text-sm">© 2026 WMS Pro. All rights reserved.</p>
          <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}