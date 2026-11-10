'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, Globe, PhoneCall, Calendar, Users, Bell,
  Check, ChevronRight, X, Loader2, Sparkles
} from 'lucide-react';
import DashboardPageLayout from '@/components/ui/page-layout';
import { getAiCapabilityProfile } from '@/lib/config/registration-constants';

// ── Capability definitions ───────────────────────────────────────────────────
//
// Availability is classified as:
//   available     — operational for this provider's business type and tier
//   planDependent — implemented but requires an eligible subscription
//   notYet        — not yet operational (e.g. DIRECT payment checkout)

interface Capability {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  availability: 'available' | 'planDependent' | 'notYet';
  availabilityLabel: string;
}

const CAPABILITIES: Capability[] = [
  {
    key: 'reports',
    title: 'Business reports and analytics',
    icon: BarChart3,
    description:
      'Review your booking activity, earnings information and available business performance reports through the dashboard.',
    availability: 'available',
    availabilityLabel: 'Available',
  },
  {
    key: 'website',
    title: 'My own business website and domain',
    icon: Globe,
    description:
      'Have a public business website connected to your booking system. A DriveBook subdomain (yourbusiness.drivebook.com.au) is available on eligible plans. A custom domain (yourbusiness.com.au) is also supported — you may need to purchase your own domain. Website and domain features depend on subscription eligibility.',
    availability: 'planDependent',
    availabilityLabel: 'Plan-dependent',
  },
  {
    key: 'ai',
    title: 'AI phone receptionist',
    icon: PhoneCall,
    description:
      'An AI receptionist can answer incoming calls, handle supported customer enquiries, check availability using your booking calendar, and assist with new bookings. Booking confirmations and relevant messages are sent automatically. This reduces missed calls and manual handling of booking enquiries.',
    availability: 'planDependent',
    availabilityLabel: 'Plan-dependent',
  },
  {
    key: 'booking',
    title: 'Online booking and scheduling',
    icon: Calendar,
    // Description and availabilityLabel are set dynamically in the component
    // based on the provider's payment model (marketplace vs SaaS)
    description: '',
    availability: 'available',
    availabilityLabel: '',
  },
  {
    key: 'crm',
    title: 'Customer management',
    icon: Users,
    description:
      'Keep customer details, booking history and supported business records organised in one place. Manage customer profiles, view past bookings, and track your client relationships.',
    availability: 'available',
    availabilityLabel: 'Available',
  },
  {
    key: 'automation',
    title: 'Business automation and notifications',
    icon: Bell,
    description:
      'Reduce repetitive administration through supported booking confirmations, appointment reminders, customer notifications, booking status updates, and email and SMS communications.',
    availability: 'available',
    availabilityLabel: 'Available',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showIntroduction, setShowIntroduction] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [otherNeeds, setOtherNeeds] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [existingDiscovery, setExistingDiscovery] = useState<any>(null);

  const providerId = session?.user?.providerId;
  const paymentModel = (session?.user as any)?.paymentModel as string | undefined;
  const businessType = (session?.user as any)?.businessType as string | undefined;
  const isSaas = paymentModel === 'saas';

  // Look up the AI capability profile from the actual service template configuration.
  // This avoids hardcoding per-businessType logic here and stays aligned with the
  // actual aiCanBook/aiCanQuote values in the preset configs.
  const aiProfile = getAiCapabilityProfile(businessType);

  // Build the capability list with business-type-specific and payment-model-specific descriptions
  const capabilities = CAPABILITIES.map(cap => {
    if (cap.key === 'booking') {
      return {
        ...cap,
        description:
          'Customers can access your public booking page, view available services and times, and submit booking requests. You manage your availability and bookings through the dashboard.' +
          (isSaas
            ? ' Direct online checkout is not yet available for SaaS providers. You can log offline bookings while online payments are being activated.'
            : ' DriveBook manages payments and pays you weekly.'),
        availabilityLabel: isSaas ? 'Partial — payments not yet available' : 'Available',
      };
    }
    if (cap.key === 'ai') {
      // Generate AI description from the actual capability profile.
      let aiDescription: string;
      if (!aiProfile.aiCanBook && aiProfile.aiCanQuote) {
        // Quote-only trades (plumber, electrician):
        // AI collects enquiry details and creates a quote request for provider review.
        // No fixed charge configuration exists in templates — do not advertise one.
        aiDescription =
          'An AI receptionist can answer incoming calls, collect job details and customer information, and create a quote request for your review. ' +
          'You receive the full enquiry details and decide whether to proceed and at what price. ' +
          'The AI does not produce a final price or quotation — that remains your responsibility.';
      } else if (aiProfile.aiCanBook && aiProfile.aiCanQuote && aiProfile.mixed) {
        // Mixed trades (tax): some services are bookable; others require a quote first.
        aiDescription =
          'An AI receptionist can answer incoming calls and book supported appointments such as consultations and standard tax returns. ' +
          'For more complex work such as business tax returns, the AI collects details and creates an enquiry for your review before any booking is confirmed. ' +
          'Booking confirmations and relevant messages are sent automatically.';
      } else {
        // Booking-capable trades (driving, beauty):
        aiDescription =
          'An AI receptionist can answer incoming calls, check availability using your booking calendar, assist with new bookings, and send booking confirmations and relevant messages. ' +
          'This reduces missed calls and manual handling of booking enquiries.';
      }
      return { ...cap, description: aiDescription };
    }
    return cap;
  });

  // Load existing discovery answers
  useEffect(() => {
    if (!providerId) return;
    fetch('/api/provider/discovery')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.discovery) {
          setExistingDiscovery(data.discovery);
          if (data.discovery.selectedGoals) {
            setSelectedGoals(new Set(data.discovery.selectedGoals));
          }
          if (data.discovery.otherNeeds) {
            setOtherNeeds(data.discovery.otherNeeds);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [providerId]);

  const toggleGoal = (key: string) => {
    setSelectedGoals(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async (skipped: boolean = false) => {
    setSaving(true);
    setSaveError('');
    try {
      // Build the request body — omit otherNeeds entirely when empty so Zod
      // .optional() handles it correctly (null is not accepted by .optional()
      // unless .nullable() is also set, which it now is — but omitting is cleaner)
      const body: Record<string, any> = {
        selectedGoals: skipped ? [] : Array.from(selectedGoals),
        skipped,
      };
      if (!skipped && otherNeeds.trim()) {
        body.otherNeeds = otherNeeds.trim();
      }

      const response = await fetch('/api/provider/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSaved(true);
        // Redirect to dashboard after a brief delay
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        const data = await response.json().catch(() => ({}));
        // Zod refine errors come as an array; flatten to a readable message
        const errors = Array.isArray(data.error)
          ? data.error.map((e: any) => e.message || String(e)).join(' ')
          : (data.error || data.message || 'Failed to save. Please try again.');
        setSaveError(errors);
      }
    } catch {
      setSaveError('Network error — please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardPageLayout title="Welcome to DriveBook" description="Discover what DriveBook can do for your business" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Discovery' }]}>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      </DashboardPageLayout>
    );
  }

  if (saved) {
    return (
      <DashboardPageLayout title="Welcome to DriveBook" description="Discover what DriveBook can do for your business" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Discovery' }]}>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 border border-green-300 mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Thank you!</h2>
          <p className="text-sm text-muted-foreground mb-6">Your answers help us provide more relevant guidance and support.</p>
          <Link href="/dashboard" className="text-violet-600 hover:text-violet-700 font-medium text-sm">Continue to dashboard →</Link>
        </div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout title="Welcome to DriveBook" description="Discover what DriveBook can do for your business" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Discovery' }]}>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* ── Optional product introduction ───────────────────────────────── */}
        {!showIntroduction && (
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-violet-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-foreground mb-1">Explore DriveBook capabilities</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Discover how DriveBook can help you establish your online presence, manage bookings, handle customer calls and organise your business.
                </p>
                <button
                  onClick={() => setShowIntroduction(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
                >
                  Explore capabilities
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Capability introduction (collapsible) ─────────────────────────── */}
        {showIntroduction && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">DriveBook capabilities</h2>
              <button
                onClick={() => setShowIntroduction(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map(cap => {
                const Icon = cap.icon;
                return (
                  <div key={cap.key} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-violet-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{cap.title}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{cap.description}</p>
                    <div className="flex items-center gap-1.5">
                      {cap.availability === 'available' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <Check className="w-3 h-3" /> {cap.availabilityLabel}
                        </span>
                      )}
                      {cap.availability === 'planDependent' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Sparkles className="w-3 h-3" /> {cap.availabilityLabel}
                        </span>
                      )}
                      {cap.availability === 'notYet' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          {cap.availabilityLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Discovery question ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-background p-6">
          <h2 className="text-lg font-bold text-foreground mb-2">What would you like to achieve with DriveBook?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Select the capabilities that interest you. Your answers help us understand your business needs and provide more relevant guidance and support.
          </p>

          <div className="space-y-3 mb-6">
            {capabilities.map(cap => {
              const Icon = cap.icon;
              const isSelected = selectedGoals.has(cap.key);
              return (
                <button
                  key={cap.key}
                  type="button"
                  onClick={() => toggleGoal(cap.key)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    isSelected ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-semibold text-gray-900">{cap.title}</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{cap.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Other needs — optional free text */}
          <div className="mb-6">
            <label htmlFor="otherNeeds" className="block text-sm font-medium text-gray-900 mb-2">
              Is there anything else you would like DriveBook to help you with?
            </label>
            <textarea
              id="otherNeeds"
              value={otherNeeds}
              onChange={e => setOtherNeeds(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Tell us about any other needs or goals…"
              className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">Optional</p>
          </div>

          {saveError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-200">
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save answers'
              )}
            </button>
          </div>
        </div>

        {existingDiscovery && (
          <p className="text-xs text-center text-muted-foreground">
            You previously submitted discovery answers. You can update them above.
          </p>
        )}
      </div>
    </DashboardPageLayout>
  );
}
