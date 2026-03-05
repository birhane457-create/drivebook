import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
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
        clients: {
          select: {
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
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Flatten bookings from all client records
    const allBookings = user.clients?.flatMap(c => c.bookings) || [];

    // Calculate totals from wallet transactions
    const transactions = user.wallet?.transactions || [];
    
    // Count all CREDIT transactions to wallet (manual adds, initial credits, etc)
    const walletCredits = transactions
      .filter(t => 
        t.type.toUpperCase() === 'CREDIT' && 
        !t.description?.toLowerCase().includes('duration reduction') &&
        !t.description?.toLowerCase().includes('refund') &&
        !t.description?.toLowerCase().includes('cancel')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Count booking payments (money paid for bookings)
    const bookingPayments = allBookings
      .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
      .reduce((sum, b) => sum + (b.price || 0), 0);
    
    // Total paid = wallet credits + booking payments
    const totalPaid = walletCredits + bookingPayments;
    
    // Net Booking Costs = booking charges minus cancellation refunds
    const bookingCharges = transactions
      .filter(t => 
        t.type.toUpperCase() === 'DEBIT' && 
        !t.description?.toLowerCase().includes('duration increase')
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const cancellationRefunds = transactions
      .filter(t => 
        t.type.toUpperCase() === 'CREDIT' && 
        (t.description?.toLowerCase().includes('refund') || 
         t.description?.toLowerCase().includes('cancel'))
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
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
      bookings: allBookings.map((b: any) => ({
        id: b.id,
        startTime: b.startTime,
        status: b.status,
        price: b.price,
        instructor: b.instructor
      }))
    });
  } catch (error) {
    console.error('Get client wallet error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
