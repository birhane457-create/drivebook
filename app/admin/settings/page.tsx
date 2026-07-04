import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import PlatformSettingsForm from '@/components/admin/PlatformSettingsForm';

export const dynamic = 'force-dynamic';

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
    : <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
}

function ConfigRow({ label, value, masked }: { label: string; value?: string; masked?: boolean }) {
  const display = masked ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : (value || 'â€”');
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-mono ${value ? 'text-slate-100' : 'text-slate-500'}`}>{display}</span>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const basicMonthly = process.env.BASIC_MONTHLY_PRICE || '29';
  const proMonthly = process.env.PRO_MONTHLY_PRICE || '79';
  const businessMonthly = process.env.BUSINESS_MONTHLY_PRICE || '199';
  const basicAnnual = process.env.BASIC_ANNUAL_PRICE || '290';
  const proAnnual = process.env.PRO_ANNUAL_PRICE || '790';
  const businessAnnual = process.env.BUSINESS_ANNUAL_PRICE || '1990';
  const basicCommission = process.env.BASIC_COMMISSION_RATE || '15';
  const proCommission = process.env.PRO_COMMISSION_RATE || '12';
  const businessCommission = process.env.BUSINESS_COMMISSION_RATE || '10';
  const basicTrial = process.env.BASIC_TRIAL_DAYS || '14';
  const proTrial = process.env.PRO_TRIAL_DAYS || '14';
  const businessTrial = process.env.BUSINESS_TRIAL_DAYS || '30';

  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  const hasStripeWebhook = !!(process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.includes('your_webhook'));
  const hasSmtp = !!process.env.SMTP_HOST;
  const hasTwilio = !!process.env.TWILIO_ACCOUNT_SID;
  const hasCloudinary = !!process.env.CLOUDINARY_API_KEY;
  const hasGoogleMaps = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasGoogleOAuth = !!process.env.GOOGLE_CLIENT_ID;
  const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_URL.length > 0);

  const tiers = [
    { name: 'Basic', color: 'text-slate-300', border: 'border-slate-700', monthly: basicMonthly, annual: basicAnnual, commission: basicCommission, trial: basicTrial },
    { name: 'Pro', color: 'text-blue-700', border: 'border-blue-700/50 bg-blue-900/20', monthly: proMonthly, annual: proAnnual, commission: proCommission, trial: proTrial },
    { name: 'Business', color: 'text-purple-700', border: 'border-violet-700/50 bg-violet-900/20', monthly: businessMonthly, annual: businessAnnual, commission: businessCommission, trial: businessTrial },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Platform Settings</h1>
            <p className="text-sm text-slate-500 mt-1">Booking rules, notification channels, integrations</p>
          </div>
          <Link href="/admin/pricing" className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Edit Pricing <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Editable: Booking Rules + Notification Matrix */}
        <PlatformSettingsForm />

        {/* Subscription Tiers â€” read-only reference */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-100">Subscription Tiers</h2>
            <span className="text-xs text-slate-500">Prices from env Â· commissions editable on Pricing page</span>
          </div>
          <div className="p-6">
            <div className="grid sm:grid-cols-3 gap-4">
              {tiers.map(t => (
                <div key={t.name} className={`border-2 ${t.border} rounded-xl p-4`}>
                  <p className={`font-bold text-sm mb-2 ${t.color}`}>{t.name}</p>
                  <p className="text-2xl font-bold text-slate-100">${t.monthly}<span className="text-sm font-normal text-slate-500">/mo</span></p>
                  <p className="text-xs text-slate-500 mb-3">${t.annual}/yr Â· {t.trial}-day trial</p>
                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex justify-between"><span>Commission</span><span className="font-medium">{t.commission}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-slate-100">Integration Status</h2>
          </div>
          <div className="p-6">
            <div className="grid sm:grid-cols-2 gap-x-8">
              {[
                { label: 'Stripe payments', ok: hasStripe },
                { label: 'Stripe webhook', ok: hasStripeWebhook },
                { label: 'Email (SMTP)', ok: hasSmtp },
                { label: 'SMS (Twilio)', ok: hasTwilio },
                { label: 'File uploads (Cloudinary)', ok: hasCloudinary },
                { label: 'Google Maps', ok: hasGoogleMaps },
                { label: 'Google Calendar OAuth', ok: hasGoogleOAuth },
                { label: 'Redis (rate limiting)', ok: hasRedis },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-2.5 py-2.5 border-b border-slate-800 last:border-0">
                  <StatusDot ok={ok} />
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className={`ml-auto text-xs font-medium ${ok ? 'text-green-600' : 'text-red-400'}`}>
                    {ok ? 'Configured' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Email Config */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800"><h2 className="font-semibold text-slate-100">Email</h2></div>
          <div className="px-6 py-2">
            <ConfigRow label="SMTP host" value={process.env.SMTP_HOST} />
            <ConfigRow label="SMTP port" value={process.env.SMTP_PORT} />
            <ConfigRow label="From address" value={process.env.EMAIL_FROM} />
            <ConfigRow label="SMTP password" masked />
          </div>
        </div>

        {/* SMS Config */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800"><h2 className="font-semibold text-slate-100">SMS (Twilio)</h2></div>
          <div className="px-6 py-2">
            <ConfigRow label="Account SID" value={process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.slice(0, 8) + 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : undefined} />
            <ConfigRow label="Phone number" value={process.env.TWILIO_PHONE_NUMBER} />
            <ConfigRow label="Auth token" masked />
          </div>
        </div>

        {/* Platform */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800"><h2 className="font-semibold text-slate-100">Platform</h2></div>
          <div className="px-6 py-2">
            <ConfigRow label="Platform name" value={process.env.PLATFORM_NAME} />
            <ConfigRow label="Admin email" value={process.env.ADMIN_EMAIL} />
            <ConfigRow label="App URL" value={process.env.NEXTAUTH_URL} />
            <ConfigRow label="Redis" value={hasRedis ? 'Upstash connected' : 'Not configured (in-memory fallback)'} />
          </div>
        </div>

      </div>
    </div>
  );
}
