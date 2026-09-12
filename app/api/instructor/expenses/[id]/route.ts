import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// DELETE — remove an expense (only the owner can delete their own)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership before deleting
    const expense = await (prisma as any).providerExpense.findUnique({
      where: { id: params.id },
      select: { providerId: true },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (expense.providerId !== session!.user!.providerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await (prisma as any).providerExpense.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/instructor/expenses/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
