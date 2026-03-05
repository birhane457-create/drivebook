import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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

    // Get all clients with wallet data
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        userId: true,
        instructorId: true,
        bookings: {
          select: { id: true, status: true, price: true }
        },
        user: {
          select: {
            wallet: {
              select: {
                balance: true,
                transactions: {
                  select: { amount: true, type: true, description: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response with calculations
    const formattedUsers = clients.map((client: any) => {
      const wallet = client.user?.wallet;
      const transactions = wallet?.transactions || [];
      const bookings = client.bookings || [];
      
      // Count all CREDIT transactions to wallet (manual adds, refunds, etc)
      const walletCredits = transactions
        .filter((t: any) => 
          t.type.toUpperCase() === 'CREDIT' && 
          !t.description?.toLowerCase().includes('duration reduction') &&
          !t.description?.toLowerCase().includes('refund') &&
          !t.description?.toLowerCase().includes('cancel')
        )
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      // Count booking payments (money paid for bookings)
      const bookingPayments = bookings
        .filter((b: any) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
        .reduce((sum: number, b: any) => sum + (b.price || 0), 0);
      
      // Total paid = wallet credits + booking payments
      const totalPaid = walletCredits + bookingPayments;
      
      // Net Booking Costs = booking charges minus cancellation refunds
      const bookingCharges = transactions
        .filter((t: any) => 
          t.type.toUpperCase() === 'DEBIT' && 
          !t.description?.toLowerCase().includes('duration increase')
        )
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      
      const cancellationRefunds = transactions
        .filter((t: any) => 
          t.type.toUpperCase() === 'CREDIT' && 
          (t.description?.toLowerCase().includes('refund') || 
           t.description?.toLowerCase().includes('cancel'))
        )
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
      
      const totalSpent = bookingCharges - cancellationRefunds;
      
      const balance = wallet?.balance || 0;
      const totalBookings = bookings.length;

      return {
        id: client.id,
        userId: client.userId,
        name: client.name,
        email: client.email,
        createdAt: client.createdAt,
        totalPaid: Number(totalPaid),
        totalSpent: Number(totalSpent),
        creditsRemaining: Number(balance),
        bookingCount: totalBookings,
        status: balance > 0 ? 'active' : balance === 0 ? 'zero-balance' : 'negative'
      };
    });

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Admin clients fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
