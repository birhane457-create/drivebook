import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PricingSettingsForm from '@/components/admin/PricingSettingsForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPricingPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Pricing & Package Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Adjust platform fees, commissions, discounts, and policies. Changes apply to new bookings immediately.
          </p>
        </div>
        <PricingSettingsForm />
      </div>
    </div>
  );
}
