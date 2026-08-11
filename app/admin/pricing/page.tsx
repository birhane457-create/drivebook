import { redirect } from 'next/navigation'
import { checkPermission } from '@/lib/rbac/checkPermission'
import { PERM } from '@/lib/rbac/permissions'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';
import PricingSettingsForm from '@/components/admin/PricingSettingsForm';
import RateChangeScheduler from '@/components/admin/RateChangeScheduler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPricingPage() {
  const session = await getServerSession(authOptions);
  const permCheck = await checkPermission(session, PERM.FINANCE_PRICING_VIEW)
  if (!permCheck.allowed) redirect('/admin')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Pricing & Commission Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Adjust platform fees, commissions, discounts, and policies. Changes apply to new bookings immediately.
          </p>
        </div>
        <PricingSettingsForm />

        {/* Scheduled rate changes — separate section below the main form */}
        <div className="mt-8">
          <RateChangeScheduler />
        </div>
      </div>
    </div>
  );
}
