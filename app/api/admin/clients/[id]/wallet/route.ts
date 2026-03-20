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
      select: { id: true, userId: true, name: true, phone: true, notes: true, preferredInstructorId: true }
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
                endTime: true,
                notes: true,
                status: true,
                price: true,
                instructorId: true,
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

    // Find current instructor (preferred or latest booking)
    let currentInstructor: { id: string; name: string; hourlyRate: number } | null = null;
    if (client) {
      let instructorId = client.preferredInstructorId || null;
      if (!instructorId && allBookings.length > 0) {
        const latest = allBookings.find(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
        instructorId = (latest as any)?.instructorId || null;
      }
      if (instructorId) {
        const instr = await prisma.instructor.findUnique({
          where: { id: instructorId },
          select: { id: true, name: true, hourlyRate: true },
        });
        currentInstructor = instr;
      }
    }

    // Calculate totals from wallet transactions
    const transactions = user.wallet?.transactions || [];
    
    // Total paid = money actually deposited (exclude refunds/cancellations)
    const totalPaid = transactions
      .filter(t =>
        t.type.toUpperCase() === "CREDIT" &&
        !t.description?.toLowerCase().includes("refund") &&
        !t.description?.toLowerCase().includes("cancel")
      )
      .reduce((sum, t) => sum + t.amount, 0);

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
      clientId: client?.id || params.id,
      user: {
        id: user.id,
        name: clientName,
        email: user.email,
        phone: client?.phone || '',
        notes: client?.notes || '',
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
        endTime: b.endTime,
        notes: b.notes,
        status: b.status,
        price: b.price,
        instructor: b.instructor
      })),
      currentInstructor,
    });
  } catch (error) {
    console.error('Get client wallet error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}





