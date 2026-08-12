import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

const centreSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  suburb: z.string().min(1),
  state: z.string().default('WA'),
  region: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_TEST_CENTRES_VIEW);
    if (deny) return deny;
    const centres = await (prisma as any).testCentre.findMany({
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(centres);
  } catch (error) {
    console.error('Admin test centres GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_TEST_CENTRES_MANAGE);
    if (deny) return deny;
    const body = await req.json();
    const data = centreSchema.parse(body);
    const centre = await (prisma as any).testCentre.create({ data });
    return NextResponse.json(centre, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Admin test centres POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
