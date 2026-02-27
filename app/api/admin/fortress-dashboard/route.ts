import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkLiquidityStatus } from '@/lib/services/liquidityControl';
import { calculateAllInstructorRiskScores } from '@/lib/services/fraudDetection';

/**
 * FORTRESS DASHBOARD API
 * 
 * Provides comprehensive operational metrics for owner:
 * - Financial health
 * - Liquidity status
 * - Fraud alerts
 * - Risk scores
 * - Staff performance
 * - SLA compliance
 */

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ============================================
    // 1. FINANCIAL HEALTH
    // ============================================
    
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    // Revenue
    const weeklyBookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: weekStart },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: {
        price: true,
        refundAmount: true,
        status: true,
      },
    });

    const totalRevenue = weeklyBookings.reduce((sum, b) => sum + b.price, 0);
    const completedBookings = weeklyBookings.filter(b => b.status === 'COMPLETED').length;
    const avgBookingValue = completedBookings > 0 ? totalRevenue / completedBookings : 0;

    // Refunds
    const totalRefunds = weeklyBookings.reduce((sum, b) => sum + (b.refundAmount || 0), 0);
    const refundPercentage = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

    // Disputes
    const disputes = await prisma.booking.count({
      where: {
        createdAt: { gte: weekStart },
        metadata: {
          path: ['disputeId'],
          not: null,
        },
      },
    });

    const disputePercentage = completedBookings > 0 ? (disputes / completedBookings) * 100 : 0;

    // Overrides
    const overrides = await prisma.task.findMany({
      where: {
        createdAt: { gte: weekStart },
        type: 'REFUND_REQUEST',
        financialImpact: {
          path: ['manualOverride'],
          equals: true,
        },
      },
      select: {
        financialImpact: true,
      },
    });

    const totalOverrides = overrides.reduce((sum, t) => {
      const impact = t.financialImpact as any;
      return sum + (impact?.overrideAmount || 0);
    }, 0);

    const overridePercentage = totalRefunds > 0 ? (totalOverrides / totalRefunds) * 100 : 0;

    // ============================================
    // 2. LIQUIDITY STATUS
    // ============================================
    
    const liquidityStatus = await checkLiquidityStatus();

    // ============================================
    // 3. FRAUD & RISK
    // ============================================
    
    const riskScores = await calculateAllInstructorRiskScores();
    const highRiskInstructors = riskScores.filter(s => s.level === 'HIGH');
    const mediumRiskInstructors = riskScores.filter(s => s.level === 'MEDIUM');

    // Recent fraud alerts
    const recentAlerts = await prisma.auditLog.findMany({
      where: {
        action: 'FRAUD_SCAN',
        createdAt: { gte: weekStart },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const latestScan = recentAlerts[0]?.metadata as any;
    const fraudAlerts = latestScan?.alerts || [];
    const highSeverityAlerts = fraudAlerts.filter((a: any) => a.severity === 'HIGH');

    // ============================================
    // 4. STAFF PERFORMANCE
    // ============================================
    
    const staffMembers = await prisma.staffMember.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        department: true,
        tasksCompleted: true,
        avgResolutionTimeHours: true,
        satisfactionScore: true,
      },
    });

    // Tasks this week
    const weeklyTasks = await prisma.task.findMany({
      where: {
        createdAt: { gte: weekStart },
      },
      select: {
        status: true,
        priority: true,
        slaBreached: true,
        assignedToId: true,
      },
    });

    const tasksByPriority = {
      URGENT: weeklyTasks.filter(t => t.priority === 'URGENT').length,
      HIGH: weeklyTasks.filter(t => t.priority === 'HIGH').length,
      NORMAL: weeklyTasks.filter(t => t.priority === 'NORMAL').length,
      LOW: weeklyTasks.filter(t => t.priority === 'LOW').length,
    };

    const slaBreaches = weeklyTasks.filter(t => t.slaBreached).length;
    const slaCompliance = weeklyTasks.length > 0 
      ? ((weeklyTasks.length - slaBreaches) / weeklyTasks.length) * 100 
      : 100;

    // ============================================
    // 5. INCIDENTS
    // ============================================
    
    const incidents = await prisma.auditLog.findMany({
      where: {
        action: { in: ['LIQUIDITY_CRITICAL', 'DISPUTE_CREATED', 'AUTO_FREEZE_HIGH_RISK'] },
        createdAt: { gte: weekStart },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ============================================
    // 6. ASSEMBLE DASHBOARD
    // ============================================
    
    const dashboard = {
      timestamp: new Date().toISOString(),
      period: {
        start: weekStart.toISOString(),
        end: now.toISOString(),
        label: 'Last 7 Days',
      },
      
      financial: {
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          bookingsCompleted: completedBookings,
          avgBookingValue: Math.round(avgBookingValue * 100) / 100,
        },
        refunds: {
          total: Math.round(totalRefunds * 100) / 100,
          percentage: Math.round(refundPercentage * 10) / 10,
          target: 5,
          status: refundPercentage < 5 ? 'HEALTHY' : refundPercentage < 8 ? 'WARNING' : 'CRITICAL',
        },
        disputes: {
          count: disputes,
          percentage: Math.round(disputePercentage * 10) / 10,
          target: 1,
          status: disputePercentage < 1 ? 'HEALTHY' : disputePercentage < 2 ? 'WARNING' : 'CRITICAL',
        },
        overrides: {
          total: Math.round(totalOverrides * 100) / 100,
          percentage: Math.round(overridePercentage * 10) / 10,
          target: 2,
          status: overridePercentage < 2 ? 'HEALTHY' : overridePercentage < 5 ? 'WARNING' : 'CRITICAL',
        },
      },
      
      liquidity: {
        currentBalance: Math.round(liquidityStatus.currentBalance * 100) / 100,
        requiredReserve: Math.round(liquidityStatus.requiredReserve * 100) / 100,
        reserveRatio: Math.round(liquidityStatus.reserveRatio * 1000) / 10,
        status: liquidityStatus.status,
        daysOfCoverage: Math.round(liquidityStatus.daysOfCoverage * 10) / 10,
        breakdown: liquidityStatus.breakdown,
        actions: liquidityStatus.actions,
      },
      
      fraud: {
        highRiskInstructors: {
          count: highRiskInstructors.length,
          instructors: highRiskInstructors.slice(0, 5).map(i => ({
            id: i.instructorId,
            name: i.instructorName,
            score: i.score,
            factors: i.factors,
          })),
        },
        mediumRiskInstructors: {
          count: mediumRiskInstructors.length,
        },
        recentAlerts: {
          total: fraudAlerts.length,
          highSeverity: highSeverityAlerts.length,
          alerts: highSeverityAlerts.slice(0, 5),
        },
      },
      
      operations: {
        staff: staffMembers.map(s => ({
          name: s.name,
          department: s.department,
          tasksCompleted: s.tasksCompleted,
          avgResolutionTime: s.avgResolutionTimeHours,
          satisfaction: s.satisfactionScore,
        })),
        tasks: {
          total: weeklyTasks.length,
          byPriority: tasksByPriority,
          slaCompliance: Math.round(slaCompliance * 10) / 10,
          slaBreaches,
        },
      },
      
      incidents: incidents.map(i => ({
        type: i.action,
        timestamp: i.createdAt,
        metadata: i.metadata,
      })),
      
      overallStatus: {
        financial: refundPercentage < 5 && disputePercentage < 1 ? 'HEALTHY' : 'WARNING',
        liquidity: liquidityStatus.status,
        fraud: highRiskInstructors.length === 0 ? 'HEALTHY' : 'WARNING',
        operations: slaCompliance > 90 ? 'HEALTHY' : 'WARNING',
      },
    };

    return NextResponse.json(dashboard);

  } catch (error) {
    console.error('Error fetching fortress dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
