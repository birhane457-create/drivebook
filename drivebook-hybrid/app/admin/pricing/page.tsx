import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PricingSettingsForm from '@/components/admin/PricingSettingsForm';

export default async function AdminPricingPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  // Get or create platform settings
  let platform = await prisma.platform.findFirst();
  
  if (!platform) {
    platform = await prisma.platform.create({
      data: {
        name: 'DriveBook',
        subscriptionModel: 'hybrid'
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pricing & Package Settings</h1>
          <p className="mt-2 text-gray-600">
            Adjust platform fees, package discounts, and commission rates based on market conditions
          </p>
        </div>

        <PricingSettingsForm platform={platform} />
      </div>
    </div>
  );
}
