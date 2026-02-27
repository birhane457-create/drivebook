import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const settings = pricingSettingsSchema.parse(body);

    // Get or create platform record
    let platform = await prisma.platform.findFirst();

    if (!platform) {
      platform = await prisma.platform.create({
        data: {
          name: 'DriveBook',
          subscriptionModel: 'hybrid',
          settings: {
            pricing: settings
          }
        }
      });
    } else {
      // Update existing platform settings
      const existingSettings = (platform.settings as any) || {};
      platform = await prisma.platform.update({
        where: { id: platform.id },
        data: {
          settings: {
            ...existingSettings,
            pricing: settings
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      settings: (platform.settings as any).pricing
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

    const platform = await prisma.platform.findFirst();

    if (!platform || !(platform.settings as any)?.pricing) {
      // Return default settings
      return NextResponse.json({
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
      });
    }

    return NextResponse.json((platform.settings as any).pricing);
  } catch (error) {
    console.error('Get pricing settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
