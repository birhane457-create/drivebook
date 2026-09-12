import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PublicNav from '@/components/PublicNav';
import { BarChart3, TrendingUp, PieChart, DollarSign } from 'lucide-react';

export const metadata = {
  title: 'Analytics & Insights | DriveBook',
  description: 'Track your business performance with powerful analytics',
};

export default function AnalyticsFeaturePage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-xl mb-6">
            <BarChart3 className="h-8 w-8 text-violet-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Analytics & Business Insights
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Make data-driven decisions with real-time analytics and insights into your service business.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="border border-border rounded-xl p-6 bg-card">
            <DollarSign className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Revenue Tracking</h3>
            <p className="text-muted-foreground">
              Monitor your income, track bookings, and see revenue trends over time. Know exactly where your business stands.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <TrendingUp className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Performance Metrics</h3>
            <p className="text-muted-foreground">
              Track booking rates, client retention, service completion, and conversion rates. Improve what matters most.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <PieChart className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Client Insights</h3>
            <p className="text-muted-foreground">
              Understand client behavior, booking patterns, and satisfaction. Provide better service with data-backed decisions.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <BarChart3 className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Custom Reports</h3>
            <p className="text-muted-foreground">
              Generate detailed reports for your business, taxes, or management. Export data anytime you need it.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Turn Data Into Growth</h2>
          <p className="text-lg mb-6 opacity-90">
            Get the insights you need to grow your business smarter, not harder.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild size="lg" variant="secondary">
              <Link href="/register/business-type">Get Started Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 border-white/20">
              <Link href="/platform">See All Features</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
