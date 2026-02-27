import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get('weekStart');
    
    if (!weekStart) {
      return NextResponse.json({ error: 'Week start date required' }, { status: 400 });
    }

    const instructorId = session.user.instructorId;
    const weekStartDate = new Date(weekStart);
    weekStartDate.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    // Get instructor details
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        name: true,
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Get all completed transactions for this week
    const transactions = await (prisma as any).transaction.findMany({
      where: {
        instructorId,
        status: 'COMPLETED',
        createdAt: {
          gte: weekStartDate,
          lte: weekEndDate
        },
        booking: {
          // Exclude package purchases
          OR: [
            { isPackageBooking: false },
            {
              AND: [
                { isPackageBooking: true },
                { parentBookingId: { not: null } }
              ]
            }
          ]
        }
      },
      include: {
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            isPackageBooking: true,
            parentBookingId: true,
            client: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate totals
    const totalGross = transactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalPlatformFee = transactions.reduce((sum: number, t: any) => sum + t.platformFee, 0);
    const totalNet = transactions.reduce((sum: number, t: any) => sum + t.instructorPayout, 0);
    const totalLessons = transactions.filter((t: any) => t.booking).length;
    
    const totalHours = transactions.reduce((sum: number, t: any) => {
      if (t.booking) {
        const start = new Date(t.booking.startTime);
        const end = new Date(t.booking.endTime);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);

    // Group by day
    const dailyBreakdown: any = {};
    transactions.forEach((t: any) => {
      const date = new Date(t.createdAt);
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      
      if (!dailyBreakdown[dayKey]) {
        dailyBreakdown[dayKey] = {
          lessons: 0,
          gross: 0,
          platformFee: 0,
          net: 0,
          transactions: []
        };
      }
      
      dailyBreakdown[dayKey].lessons += t.booking ? 1 : 0;
      dailyBreakdown[dayKey].gross += t.amount;
      dailyBreakdown[dayKey].platformFee += t.platformFee;
      dailyBreakdown[dayKey].net += t.instructorPayout;
      dailyBreakdown[dayKey].transactions.push({
        description: t.description,
        clientName: t.booking?.client.name || 'N/A',
        time: t.booking ? new Date(t.booking.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        gross: t.amount,
        platformFee: t.platformFee,
        net: t.instructorPayout,
        isFromPackage: t.booking?.isPackageBooking && t.booking?.parentBookingId
      });
    });

    // Generate text receipt
    const receipt = `
═══════════════════════════════════════════════════════════
                    WEEKLY EARNINGS RECEIPT
═══════════════════════════════════════════════════════════

Instructor: ${instructor.name}
Email: ${instructor.user.email}
Period: ${weekStartDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
     to ${weekEndDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

───────────────────────────────────────────────────────────
DAILY BREAKDOWN
───────────────────────────────────────────────────────────

${Object.entries(dailyBreakdown).map(([day, data]: [string, any]) => `
${day}
  Lessons: ${data.lessons}
  Gross: $${data.gross.toFixed(2)}
  Platform Fee: -$${data.platformFee.toFixed(2)}
  Net: $${data.net.toFixed(2)}
  
  Individual Lessons:
${data.transactions.map((t: any) => `    • ${t.clientName} at ${t.time}${t.isFromPackage ? ' (Package)' : ''}
      Gross: $${t.gross.toFixed(2)} | Fee: -$${t.platformFee.toFixed(2)} | Net: $${t.net.toFixed(2)}`).join('\n')}
`).join('\n')}

───────────────────────────────────────────────────────────
WEEKLY SUMMARY
───────────────────────────────────────────────────────────

Total Lessons:        ${totalLessons}
Total Hours:          ${totalHours.toFixed(1)}h
Gross Earnings:       $${totalGross.toFixed(2)}
Platform Fee:         -$${totalPlatformFee.toFixed(2)}
Processing Fees:      $0.00
───────────────────────────────────────────────────────────
NET EARNINGS:         $${totalNet.toFixed(2)}
═══════════════════════════════════════════════════════════

Generated: ${new Date().toLocaleString('en-US')}

This receipt is for your records. Keep it for tax purposes.
For questions, contact support@drivebook.com

═══════════════════════════════════════════════════════════
`;

    // Return as downloadable text file
    return new NextResponse(receipt, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="weekly-receipt-${weekStart}.txt"`
      }
    });

  } catch (error) {
    console.error('Weekly receipt error:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
