import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    
    // Check admin role
    const admin = await prisma.user.findUnique({
      where: { email: session?.user?.email || '' },
      select: { role: true }
    });

    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // The ID could be either a client ID or user ID
    // Try to find client first, then get user
    let userId: string | null = null;
    let clientName = 'Unknown';
    
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: { userId: true, name: true }
    });
    
    if (client) {
      userId = client.userId;
      clientName = client.name;
    } else {
      // Maybe it's a user ID directly
      userId = params.id;
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Client has no associated user account' }, { status: 404 });
    }

    // Get user with wallet details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            transactions: {
              select: {
                id: true,
                amount: true,
                type: true,
                description: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' },
              take: 50
            }
          }
        },
        bookings: {
          select: {
            id: true,
            startTime: true,
            status: true,
            price: true,
            instructor: { select: { name: true } }
          },
          orderBy: { startTime: 'desc' }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate totals from wallet transactions
    const transactions = user.wallet?.transactions || [];
    
    // Total Credits Added = only actual money paid by user (exclude admin refunds/credits, duration adjustments)
    const totalPaid = transactions
      .filter(t => 
        t.type === 'CREDIT' && 
        !t.description?.toLowerCase().includes('duration reduction') &&
        !t.description?.toLowerCase().includes('manual credit') &&
        !t.description?.toLowerCase().includes('refund') &&
        !t.description?.toLowerCase().includes('admin')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Net Booking Costs = booking charges minus cancellation refunds
    const bookingCharges = transactions
      .filter(t => 
        t.type === 'DEBIT' && 
        !t.description?.toLowerCase().includes('duration increase')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    const cancellationRefunds = transactions
      .filter(t => 
        t.type === 'CREDIT' && 
        (t.description?.toLowerCase().includes('refund') || 
         t.description?.toLowerCase().includes('cancel'))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalSpent = bookingCharges - cancellationRefunds;
    
    const balance = user.wallet?.balance || 0;

    return NextResponse.json({
      user: {
        id: user.id,
        name: clientName,
        email: user.email,
        createdAt: user.createdAt
      },
      wallet: {
        id: user.wallet?.id,
        balance: Number(balance),
        totalPaid: Number(totalPaid),
        totalSpent: Number(totalSpent),
        creditsRemaining: Number(balance),
        transactions: transactions
      },
      bookings: user.bookings?.map((b: any) => ({
        id: b.id,
        startTime: b.startTime,
        status: b.status,
        price: b.price,
        instructor: b.instructor
      })) || []
    });
  } catch (error) {
    console.error('Get client wallet error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
