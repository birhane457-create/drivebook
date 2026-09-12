import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PublicNav from '@/components/PublicNav';
import { Users, FileText, MessageSquare, Award } from 'lucide-react';

export const metadata = {
  title: 'Client Management | DriveBook',
  description: 'Complete CRM for managing your clients',
};

export default function ClientManagementFeaturePage() {
  return (
    <div className="light min-h-screen bg-background text-foreground">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-xl mb-6">
            <Users className="h-8 w-8 text-violet-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Client Management & CRM
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Keep track of every client's journey from their first booking to completion. All in one place.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="border border-border rounded-xl p-6 bg-card">
            <Users className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Complete Client Profiles</h3>
            <p className="text-muted-foreground">
              Store contact details, service history, booking records, and notes. Everything you need in one place.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <Award className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Progress Tracking</h3>
            <p className="text-muted-foreground">
              Track each client's progress, sessions completed, and goals achieved. Share progress reports with clients.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <MessageSquare className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Communication Hub</h3>
            <p className="text-muted-foreground">
              Message clients directly, send reminders, and keep all communication history organized and accessible.
            </p>
          </div>

          <div className="border border-border rounded-xl p-6 bg-card">
            <FileText className="h-10 w-10 text-violet-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Session Notes & Reports</h3>
            <p className="text-muted-foreground">
              Add notes after each session, track what was covered, and generate progress reports for clients.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Manage Clients Like a Pro</h2>
          <p className="text-lg mb-6 opacity-90">
            Spend less time on admin and more time serving clients with DriveBook's powerful client management tools.
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
