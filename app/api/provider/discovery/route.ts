import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_GOAL_KEYS = ['reports', 'website', 'ai', 'booking', 'crm', 'automation'] as const;
type GoalKey = typeof VALID_GOAL_KEYS[number];

const discoverySchema = z.object({
  // Array of selected capability keys — must be from the known set
  selectedGoals: z.array(z.enum(VALID_GOAL_KEYS)).optional().default([]),
  // Optional free-text "other needs" — nullable so the page can send null
  otherNeeds: z.string().max(2000).nullable().optional(),
  // Whether the provider is skipping discovery (can complete later)
  skipped: z.boolean().optional().default(false),
}).refine(
  data => {
    // When not skipping, at least one goal must be selected or otherNeeds must be non-empty.
    // This prevents empty discovery records that would hide the invitation permanently.
    if (!data.skipped) {
      const hasGoals = (data.selectedGoals?.length ?? 0) > 0;
      const hasOtherNeeds = !!data.otherNeeds?.trim();
      return hasGoals || hasOtherNeeds;
    }
    return true;
  },
  {
    message: 'Please select at least one capability or describe your needs before saving.',
    path: ['selectedGoals'],
  }
);

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
