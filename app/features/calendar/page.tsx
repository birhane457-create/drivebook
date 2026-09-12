import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PublicNav from '@/components/PublicNav';
import { Calendar, Clock, Users, Zap } from 'lucide-react';

export const metadata = {
  title: 'Calendar & Scheduling | DriveBook',
  description: 'Smart calendar and scheduling tools for service professionals',
};

export default function CalendarFeaturePage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-xl mb-6">
            <Calendar className="h-8 w-8 text-violet-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Smart Calendar & Scheduling
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Manage your availability, schedule appointments, and sync with your favorite calendar apps—all in one place.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="border border-border rounded-xl p-6 bg-card">
            <Clock className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Flexible Availability</h3>
            <p className="text-muted-foreground">
              Set your working hours, recurring schedules, and time-off with ease. Clients only see your available slots.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Zap className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Instant Booking</h3>
            <p className="text-muted-foreground">
              Clients can book available slots instantly. Automatic confirmations and reminders keep everyone on track.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Users className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Multi-Professional Support</h3>
            <p className="text-muted-foreground">
              Manage multiple team calendars from one dashboard. Perfect for businesses with multiple service providers.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Calendar className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Calendar Sync</h3>
            <p className="text-muted-foreground">
              Two-way sync with Google Calendar, Outlook, and Apple Calendar. Never double-book again.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to simplify your scheduling?</h2>
          <p className="text-lg mb-6 opacity-90">
            Join hundreds of professionals who save hours every week with DriveBook's smart calendar.
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
