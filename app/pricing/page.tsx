import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PublicNav from '@/components/PublicNav';
import { Check } from 'lucide-react';

export const metadata = {
  title: 'Pricing | DriveBook',
  description: 'Simple, transparent pricing for service professionals',
};

export default function PricingPage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your business. All plans include core features to run your professional service business.
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Starter */}
          <div className="border border-border rounded-xl p-8 bg-card hover:shadow-lg transition-shadow">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Starter</h3>
              <div className="text-4xl font-bold mb-2">3.6%</div>
              <p className="text-muted-foreground">per booking</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Online booking system</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Calendar & scheduling</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Client management</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Payment processing</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Basic analytics</span>
              </li>
            </ul>

            <Button asChild className="w-full">
              <Link href="/register/business-type">Get Started</Link>
            </Button>
          </div>

          {/* PRO */}
          <div className="border-2 border-violet-600 rounded-xl p-8 bg-card hover:shadow-xl transition-shadow relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-4 py-1 rounded-full text-sm font-bold">
              Most Popular
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">PRO</h3>
              <div className="text-4xl font-bold mb-2">3.6%</div>
              <p className="text-muted-foreground">per booking</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Everything in Starter</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <span className="font-semibold">🤖 AI Receptionist</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Advanced analytics</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Marketing tools</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Priority support</span>
              </li>
            </ul>

            <Button asChild className="w-full bg-violet-600 hover:bg-violet-700">
              <Link href="/register/business-type">Get Started</Link>
            </Button>
          </div>

          {/* STUDIO */}
          <div className="border border-border rounded-xl p-8 bg-card hover:shadow-lg transition-shadow">
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">STUDIO</h3>
              <div className="text-4xl font-bold mb-2">3.6%</div>
              <p className="text-muted-foreground">per booking</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Everything in PRO</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <span className="font-semibold">👥 Multi-Professional</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <span className="font-semibold">🌐 Custom Domain</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>White-label experience</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Team management</span>
              </li>
            </ul>

            <Button asChild className="w-full">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-secondary/50 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">Not sure which plan is right for you?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Our team is here to help you choose the perfect plan for your business needs.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild variant="outline" size="lg">
              <Link href="/teach-with-drivebook">Learn More</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
