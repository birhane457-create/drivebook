import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ── Validation ───────────────────────────────────────────────────────────────

const discoverySchema = z.object({
  // Array of selected capability keys — must be from the known set
  selectedGoals: z.array(
    z.enum(['reports', 'website', 'ai', 'booking', 'crm', 'automation'])
  ).optional().default([]),
  // Optional free-text "other needs"
  otherNeeds: z.string().max(2000).optional(),
  // Whether the provider is skipping discovery (can complete later)
  skipped: z.boolean().optional().default(false),
});

// ── GET: Retrieve existing discovery answers ────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.providerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discovery = await prisma.providerDiscovery.findUnique({
    where: { providerId: session.user.providerId },
  });

  return NextResponse.json({ discovery });
}

// ── POST: Save or update discovery answers ──────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.providerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = discoverySchema.parse(body);

    // Upsert — if a discovery record already exists, update it.
    // This allows providers to update their answers later.
    const discovery = await prisma.providerDiscovery.upsert({
      where: { providerId: session.user.providerId },
      create: {
        providerId: session.user.providerId,
        selectedGoals: data.selectedGoals,
        otherNeeds: data.otherNeeds ?? null,
        skipped: data.skipped,
      },
      update: {
        selectedGoals: data.selectedGoals,
        otherNeeds: data.otherNeeds ?? null,
        skipped: data.skipped,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, discovery });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Discovery save error:', error);
    return NextResponse.json({ error: 'Failed to save discovery answers' }, { status: 500 });
  }
}
