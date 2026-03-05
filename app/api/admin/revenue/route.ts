import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all transactions
    const transactions = await (prisma as any).transaction.findMany({
      include: {
        booking: {
          select: {
            instructor: {
              select: {
                id: true,
                name: true,
              }
            },
            client: {
              select: {
                name: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total platform revenue (all platform fees)
    const totalRevenue = transactions
      .filter((t: any) => t.status === 'COMPLETED')
      .reduce((sum: number, t: any) => sum + t.platformFee, 0);

    // Calculate this month and last month revenue
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthRevenue = transactions
      .filter((t: any) => 
        t.status === 'COMPLETED' && 
        new Date(t.createdAt) >= startOfThisMonth
      )
      .reduce((sum: number, t: any) => sum + t.platformFee, 0);

    const lastMonthRevenue = transactions
      .filter((t: any) => 
        t.status === 'COMPLETED' && 
        new Date(t.createdAt) >= startOfLastMonth &&
        new Date(t.createdAt) <= endOfLastMonth
      )
      .reduce((sum: number, t: any) => sum + t.platformFee, 0);

    // Calculate pending and completed payouts
    const pendingPayouts = transactions
      .filter((t: any) => t.status === 'PENDING')
      .reduce((sum: number, t: any) => sum + t.instructorPayout, 0);

    const completedPayouts = transactions
      .filter((t: any) => t.status === 'COMPLETED')
      .reduce((sum: number, t: any) => sum + t.instructorPayout, 0);

    // Calculate refund statistics
    const totalRefunds = transactions
      .filter((t: any) => t.status === 'REFUNDED')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const pendingRefunds = transactions
      .filter((t: any) => t.status === 'PENDING' && t.type === 'REFUND')
      .length;

    // Get top earning instructors
    const instructorEarnings = new Map<string, { name: string; earnings: number; count: number }>();
    
    transactions
      .filter((t: any) => t.status === 'COMPLETED' && t.booking?.instructor)
      .forEach((t: any) => {
        const existing = instructorEarnings.get(t.instructorId) || { 
          name: t.booking.instructor.name, 
          earnings: 0, 
          count: 0 
        };
        existing.earnings += t.instructorPayout;
        existing.count += 1;
        instructorEarnings.set(t.instructorId, existing);
      });

    const topInstructors = Array.from(instructorEarnings.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        totalEarnings: data.earnings,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, 10);

    // Revenue by month (last 6 months)
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthRevenue = transactions
        .filter((t: any) => 
          t.status === 'COMPLETED' &&
          new Date(t.createdAt) >= monthStart &&
          new Date(t.createdAt) <= monthEnd
        )
        .reduce((sum: number, t: any) => sum + t.platformFee, 0);

      const monthTransactions = transactions
        .filter((t: any) => 
          t.status === 'COMPLETED' &&
          new Date(t.createdAt) >= monthStart &&
          new Date(t.createdAt) <= monthEnd
        ).length;

      revenueByMonth.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue,
        transactions: monthTransactions,
      });
    }

    // Recent transactions (last 20)
    const recentTransactions = transactions.slice(0, 20);

    return NextResponse.json({
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      pendingPayouts,
      completedPayouts,
      totalRefunds,
      pendingRefunds,
      totalTransactions: transactions.filter((t: any) => t.status === 'COMPLETED').length,
      topInstructors,
      revenueByMonth,
      recentTransactions,
    });
  } catch (error) {
    console.error('Admin revenue fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
