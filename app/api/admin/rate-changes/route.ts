import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

const FIELD_LABELS: Record<string, string> = {
  basicCommissionRate: 'Basic commission rate',
  proCommissionRate: 'Pro commission rate',
  businessCommissionRate: 'Business commission rate',
};

const createSchema = z.object({
  field: z.enum(['basicCommissionRate', 'proCommissionRate', 'businessCommissionRate']),
  newRate: z.number().min(0).max(50),
  effectiveDate: z.string().datetime(),
  reason: z.string().min(10).max(500),
});

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
}

// GET — list all pending and recent rate changes
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const changes = await prisma.$queryRaw<any[]>`
      SELECT * FROM "PlatformRateChange"
      ORDER BY "effectiveDate" ASC
      LIMIT 50
    `;

    return NextResponse.json({ changes });
  } catch (error) {
    console.error('GET rate changes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — schedule a new rate change
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    const effectiveDate = new Date(data.effectiveDate);
    if (effectiveDate <= new Date()) {
      return NextResponse.json(
        { error: 'Effective date must be in the future' },
        { status: 400 }
      );
    }

    // Get current rate from PlatformSettings
    const settings = await prisma.platformSettings.findUnique({ where: { key: 'default' } });
    const currentRate = settings ? (settings as any)[data.field] ?? 0 : 0;

    if (currentRate === data.newRate) {
      return NextResponse.json(
        { error: 'New rate is the same as the current rate' },
        { status: 400 }
      );
    }

    // Cancel any existing PENDING change for the same field (raw SQL)
    await prisma.$executeRaw`
      UPDATE "PlatformRateChange"
      SET "status" = 'CANCELLED', "updatedAt" = NOW()
      WHERE "field" = ${data.field} AND "status" = 'PENDING'
    `;

    // Generate a CUID-like ID
    const changeId = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const tier = data.field.replace('CommissionRate', '').toUpperCase();

    await prisma.$executeRaw`
      INSERT INTO "PlatformRateChange"
        ("id", "tier", "field", "currentRate", "newRate", "effectiveDate", "reason", "status", "createdBy", "createdAt", "updatedAt")
      VALUES
        (${changeId}, ${tier}, ${data.field}, ${currentRate}, ${data.newRate}, ${effectiveDate}, ${data.reason.trim()}, 'PENDING', ${session!.user.id}, NOW(), NOW())
    `;

    const change = { id: changeId, tier, field: data.field, currentRate, newRate: data.newRate, effectiveDate, reason: data.reason.trim(), status: 'PENDING' };

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          action: 'RATE_CHANGE_SCHEDULED',
          actorId: session!.user.id,
          actorRole: session!.user.role,
          targetType: 'PLATFORM_SETTINGS',
          targetId: change.id,
          success: true,
          metadata: {
            field: data.field,
            fieldLabel: FIELD_LABELS[data.field],
            currentRate,
            newRate: data.newRate,
            effectiveDate: effectiveDate.toISOString(),
            reason: data.reason,
          } as any,
        },
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json({ change }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('POST rate change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
