import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '../../../../lib/prisma';

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
        user: {
          select: {
            wallet: {
              select: {
                balance: true,
                transactions: {
                  select: { amount: true, type: true, description: true }
                }
              }
            },
            bookings: {
              select: { id: true, status: true }
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
      const bookings = client.user?.bookings || [];
      
      // Calculate from wallet transactions
      // Only count actual money paid by user (initial credits, Stripe payments)
      // Exclude: duration adjustments, manual admin refunds/credits
      const totalPaid = transactions
        .filter((t: any) => 
          t.type === 'CREDIT' && 
          !t.description?.toLowerCase().includes('duration reduction') &&
          !t.description?.toLowerCase().includes('manual credit') &&
          !t.description?.toLowerCase().includes('refund') &&
          !t.description?.toLowerCase().includes('admin')
        )
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      // Net Booking Costs = booking charges minus cancellation refunds
      const bookingCharges = transactions
        .filter((t: any) => 
          t.type === 'DEBIT' && 
          !t.description?.toLowerCase().includes('duration increase')
        )
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      const cancellationRefunds = transactions
        .filter((t: any) => 
          t.type === 'CREDIT' && 
          (t.description?.toLowerCase().includes('refund') || 
           t.description?.toLowerCase().includes('cancel'))
        )
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
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
