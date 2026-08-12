import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformPricing } from '@/lib/services/platform-pricing';
import { z } from 'zod';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

const pricingSchema = z.object({
  platformFeePercentage:      z.number().min(0).max(10),
  package6Discount:           z.number().min(0).max(20),
  package10Discount:          z.number().min(0).max(20),
  package15Discount:          z.number().min(0).max(20),
  basicCommissionRate:        z.number().min(0).max(30),
  proCommissionRate:          z.number().min(0).max(30),
  studioCommissionRate:       z.number().min(0).max(30).optional().default(11),
  businessCommissionRate:     z.number().min(0).max(30),
  discountPaidBy:             z.enum(['platform', 'shared', 'instructor']),
  cancellationFee:            z.number().min(0).max(500).optional().default(0),
  lateCancellationWindowHours:z.number().min(0).max(72).optional().default(24),
  noShowPenaltyAmount:        z.number().min(0).max(500).optional().default(0),
  walletTopUpMin:             z.number().min(1).max(100).optional().default(10),
  walletTopUpMax:             z.number().min(100).max(5000).optional().default(500),
  gstEnabled:                 z.boolean().optional().default(true),
  gstRate:                    z.number().min(0).max(30).optional().default(10),
  withholdingTaxRate:         z.number().min(0).max(47).optional().default(47),
  peakSurchargeEnabled:       z.boolean().optional().default(false),
  peakSurchargePercent:       z.number().min(0).max(50).optional().default(0),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PRICING_VIEW);
    if (deny) return deny;
    const settings = await getPlatformPricing();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get pricing settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PRICING_MANAGE);
    if (deny) return deny;

    const body = await req.json();
    const data = pricingSchema.parse(body);

    // Upsert the singleton record
    const settings = await prisma.platformSettings.upsert({
      where: { key: 'default' },
      update: { ...data, updatedBy: session!.user.id },
      create: { key: 'default', ...data, updatedBy: session!.user.id },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Pricing settings update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
