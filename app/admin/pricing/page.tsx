import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import PricingSettingsForm from '@/components/admin/PricingSettingsForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPricingPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  // Fetch platform settings from database
  let platformData = await prisma.platform.findFirst();
  
  // If no platform record exists, use defaults
  if (!platformData) {
    platformData = {
      id: '',
      name: 'DriveBook',
      subscriptionModel: 'hybrid',
      settings: {
        pricing: {
          platformFeePercentage: 3.6,
          package6Discount: 5,
          package10Discount: 10,
          package15Discount: 12,
          basicCommissionRate: 15,
          proCommissionRate: 12,
          businessCommissionRate: 10,
          basicNewStudentBonus: 8,
          proNewStudentBonus: 10,
          businessNewStudentBonus: 12,
          drivingTestPackagePrice: 225,
          discountPaidBy: 'shared'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
  }

  const platform = {
    id: platformData.id || '',
    name: platformData.name,
    subscriptionModel: platformData.subscriptionModel,
    settings: platformData.settings
  };

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
