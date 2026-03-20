import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  const admin = await prisma.user.findUnique({
    where: { email: session?.user?.email || '' },
    select: { role: true },
  });
  return admin?.role === 'ADMIN' || admin?.role === 'SUPER_ADMIN';
}

// PATCH - Edit client details (name, email, phone)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

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
