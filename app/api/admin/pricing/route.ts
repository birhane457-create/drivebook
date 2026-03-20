import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const pricingSettingsSchema = z.object({
  platformFeePercentage: z.number().min(0).max(10),
  package6Discount: z.number().min(0).max(20),
  package10Discount: z.number().min(0).max(20),
  package15Discount: z.number().min(0).max(20),
  basicCommissionRate: z.number().min(0).max(30),
  proCommissionRate: z.number().min(0).max(30),
  businessCommissionRate: z.number().min(0).max(30),
  basicNewStudentBonus: z.number().min(0).max(20),
  proNewStudentBonus: z.number().min(0).max(20),
  businessNewStudentBonus: z.number().min(0).max(20),
  drivingTestPackagePrice: z.number().min(0).max(500),
  discountPaidBy: z.enum(['platform', 'shared', 'instructor'])
});

// Default pricing settings (Platform model not in schema)
const DEFAULT_SETTINGS = {
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
  discountPaidBy: 'shared' as const
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const settings = pricingSettingsSchema.parse(body);

    // TODO: Add Platform model to schema to enable dynamic pricing updates
    // For now, return success but settings won't persist
    console.log('Pricing settings update requested (not persisted - Platform model missing):', settings);

    return NextResponse.json({
      success: true,
      settings,
      warning: 'Settings validated but not persisted. Add Platform model to schema to enable persistence.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Pricing settings update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return default settings (Platform model not in schema)
    return NextResponse.json(DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Get pricing settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
