import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  suburb: z.string().min(1).optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isActive: z.boolean().optional(),
});

function isAdmin(role: string) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const data = updateSchema.parse(body);
    const centre = await (prisma as any).testCentre.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(centre);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Admin test centre PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Soft delete — set isActive = false
    const centre = await (prisma as any).testCentre.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, centre });
  } catch (error) {
    console.error('Admin test centre DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
