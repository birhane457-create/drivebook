import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
}

// DELETE — cancel a pending rate change
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.$queryRaw<Array<{ status: string }>>`
      SELECT "status" FROM "PlatformRateChange" WHERE "id" = ${params.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (rows[0].status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only PENDING rate changes can be cancelled' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE "PlatformRateChange"
      SET "status" = 'CANCELLED', "updatedAt" = NOW()
      WHERE "id" = ${params.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE rate change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
