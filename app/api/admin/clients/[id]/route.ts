import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.USERS_CLIENTS_EDIT);
  if (deny) return deny;

  try {
    const body = await req.json();
    const { name, email, phone, notes } = body;

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(notes !== undefined && { notes }),
      },
      select: { id: true, name: true, email: true, phone: true, notes: true },
    });

    return NextResponse.json({ success: true, client: updated });
  } catch (error) {
    console.error('Edit client error:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}
