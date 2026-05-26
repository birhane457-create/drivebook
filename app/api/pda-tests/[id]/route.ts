// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'PENDING']),
  notes: z.string().optional(),
});

// PUT — update PDA test result
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Verify booking belongs to this instructor and is a PDA test
    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        instructorId: session.user.instructorId,
        bookingType: 'PDA_TEST',
      } as any,
    });

    if (!booking) {
      return NextResponse.json({ error: 'PDA test not found' }, { status: 404 });
    }

    const updated = await prisma.booking.update({
      where: { id: params.id },
      data: {
        instructorNotes: `RESULT: ${data.result}`,
        notes: data.notes !== undefined ? data.notes : booking.notes,
      },
    });

    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('PDA test update error:', error);
    return NextResponse.json({ error: 'Failed to update PDA test' }, { status: 500 });
  }
}

// DELETE — remove a PDA test (soft delete via CANCELLED status)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: params.id,
        instructorId: session.user.instructorId,
        bookingType: 'PDA_TEST',
      } as any,
    });

    if (!booking) {
      return NextResponse.json({ error: 'PDA test not found' }, { status: 404 });
    }

    await prisma.booking.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', deletedAt: new Date() } as any,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PDA test delete error:', error);
    return NextResponse.json({ error: 'Failed to delete PDA test' }, { status: 500 });
  }
}
