import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PublicNav from '@/components/PublicNav';
import { Megaphone, Search, Share2, Star } from 'lucide-react';

export const metadata = {
  title: 'Marketing & SEO | DriveBook',
  description: 'Grow your business with powerful marketing tools',
};

export default function MarketingFeaturePage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-xl mb-6">
            <Megaphone className="h-8 w-8 text-violet-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Marketing & SEO Tools
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get discovered by more clients with built-in marketing tools, SEO optimization, and professional branding.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="border border-border rounded-xl p-6 bg-card">
            <Search className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">SEO Optimization</h3>
            <p className="text-muted-foreground">
              Get found on Google with automatically optimized profiles and local SEO for your area.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Star className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Reviews & Ratings</h3>
            <p className="text-muted-foreground">
              Collect reviews from clients automatically. Build trust and social proof that attracts more bookings.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Share2 className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Professional Website</h3>
            <p className="text-muted-foreground">
              Get a beautiful, mobile-friendly booking website that showcases your services and captures leads 24/7.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Megaphone className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Social Sharing</h3>
            <p className="text-muted-foreground">
              Share your profile, promotions, and availability easily on social media. Turn followers into clients.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Get More Clients</h2>
          <p className="text-lg mb-6 opacity-90">
            Stop relying on word-of-mouth alone. Let DriveBook help you attract and convert more clients online.
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
