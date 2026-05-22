import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        termsAcceptedAt: true,
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
            approvalStatus: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            isActive: true,
            abn: true,
            abnVerified: true,
            withholdingTaxRate: true,
            bookings: {
              orderBy: { startTime: 'desc' },
              take: 5,
              select: {
                id: true,
                startTime: true,
                status: true,
                price: true,
                client: { select: { name: true } },
              },
            },
          },
        },
        wallet: {
          select: {
            balance: true,
            transactions: {
              select: { id: true },
              where: { status: 'CONFIRMED' },
            },
          },
        },
        clients: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            bookings: {
              orderBy: { startTime: 'desc' },
              take: 5,
              select: {
                id: true,
                startTime: true,
                status: true,
                price: true,
                instructor: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const bookingCount = user.clients.reduce((sum: number, c: any) => sum + c.bookings.length, 0);
    const walletBalance = (user.wallet as any)?.balance ?? 0;
    const txCount = (user.wallet as any)?.transactions?.length ?? 0;

    // Phone comes from the first client record (CLIENT role) or instructor record
    const phone = user.instructor?.phone
      || (user.clients.length > 0 ? (user.clients[0] as any).phone : null)
      || null;

    // Build recent bookings for inline display
    const recentBookings = user.instructor
      ? (user.instructor.bookings as any[]).map((b: any) => ({
          id: b.id,
          startTime: b.startTime,
          status: b.status,
          price: b.price,
          clientName: b.client?.name || null,
        }))
      : (user.clients as any[])
          .flatMap((c: any) =>
            c.bookings.map((b: any) => ({
              id: b.id,
              startTime: b.startTime,
              status: b.status,
              price: b.price,
              instructorName: b.instructor?.name || null,
            }))
          )
          .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 5);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone,
      role: user.role,
      createdAt: user.createdAt,
      termsAcceptedAt: user.termsAcceptedAt,
      instructor: user.instructor
        ? {
            id: user.instructor.id,
            name: user.instructor.name,
            phone: user.instructor.phone,
            approvalStatus: user.instructor.approvalStatus,
            subscriptionTier: user.instructor.subscriptionTier,
            subscriptionStatus: (user.instructor as any).subscriptionStatus,
            trialEndsAt: (user.instructor as any).trialEndsAt,
            isActive: (user.instructor as any).isActive,
            abn: user.instructor.abn,
            abnVerified: user.instructor.abnVerified,
            withholdingTaxRate: user.instructor.withholdingTaxRate,
          }
        : null,
      wallet: user.wallet ? { balance: walletBalance, transactionCount: txCount } : null,
      bookingCount,
      clientId: user.clients.length > 0 ? user.clients[0].id : null,
      recentBookings,
    });
  } catch (error) {
    console.error('Admin get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update user name and email (admin on behalf of user)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, phone, email } = await req.json();

    // If email is changing, check it's not already taken
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: params.userId } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use by another account' }, { status: 409 });
      }
    }

    // Update User record (name + email live here)
    const updated = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
      },
      select: { id: true, name: true, email: true },
    });

    // Sync name + phone to Instructor record if this is an instructor
    const instructor = await prisma.instructor.findFirst({ where: { userId: params.userId } });
    if (instructor) {
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: {
          ...(name !== undefined && { name }),
          ...(phone !== undefined && { phone }),
        },
      });
    }

    // Sync name + phone to Client records if this is a client
    if (!instructor && (name !== undefined || phone !== undefined)) {
      await prisma.client.updateMany({
        where: { userId: params.userId },
        data: {
          ...(name !== undefined && { name }),
          ...(phone !== undefined && { phone }),
        },
      });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
