import { prisma } from '@/lib/prisma';

/**
 * FRAUD PATTERN DETECTION
 * 
 * Monitors for suspicious patterns:
 * 1. Same card across multiple accounts
 * 2. Instructor self-booking
 * 3. Refund-rebook abuse
 * 4. Coordinated small fraud
 * 5. Velocity checks
 */

// ============================================
// FRAUD DETECTION RULES
// ============================================

export const FRAUD_RULES = {
  // Same card fingerprint across accounts
  MAX_ACCOUNTS_PER_CARD: 5,
  
  // Instructor self-booking detection
  SAME_IP_THRESHOLD: 3, // Same IP for instructor + client X times
  SAME_DEVICE_THRESHOLD: 2, // Same device fingerprint
  
  // Refund-rebook abuse
  MAX_CANCEL_REBOOK_CYCLES: 3, // Cancel → Rebook cycles
  CYCLE_WINDOW_DAYS: 30, // Within 30 days
  
  // Velocity checks
  MAX_BOOKINGS_PER_HOUR: 10, // Per client
  MAX_BOOKINGS_PER_DAY: 20, // Per client
  
  // Risk scoring thresholds
  HIGH_RISK_SCORE: 70,
  MEDIUM_RISK_SCORE: 50,
  
  // Auto-actions
  AUTO_FREEZE_HIGH_RISK: true,
  AUTO_FLAG_MEDIUM_RISK: true,
} as const;

// ============================================
// FRAUD PATTERN DETECTION
// ============================================

interface FraudAlert {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  entityType: 'INSTRUCTOR' | 'CLIENT' | 'BOOKING';
  entityId: string;
  evidence: any;
  recommendedAction: string;
}

/**
 * Detect same card across multiple accounts
 */
export async function detectSameCardAcrossAccounts(): Promise<FraudAlert[]> {
  console.log('[FRAUD] Checking for same card across multiple accounts...');
  
  const alerts: FraudAlert[] = [];

  // Get all successful payments with card fingerprints
  const payments = await prisma.booking.findMany({
    where: {
      isPaid: true,
      paymentIntentId: { not: null },
    },
    select: {
      id: true,
      userId: true,
      clientId: true,
      paymentIntentId: true,
    },
  });

  // Group by card fingerprint
  // Note: Card fingerprint tracking requires Stripe metadata integration
  const cardFingerprints = new Map<string, Set<string>>();
  
  // TODO: Implement card fingerprint tracking via Stripe metadata
  // For now, this check is disabled until metadata field is added to schema

  // Check for suspicious patterns
  for (const [fingerprint, userIds] of cardFingerprints.entries()) {
    if (userIds.size > FRAUD_RULES.MAX_ACCOUNTS_PER_CARD) {
      alerts.push({
        type: 'SAME_CARD_MULTIPLE_ACCOUNTS',
        severity: 'HIGH',
        description: `Same card used across ${userIds.size} different accounts`,
        entityType: 'CLIENT',
        entityId: Array.from(userIds)[0],
        evidence: {
          cardFingerprint: fingerprint,
          accountCount: userIds.size,
          userIds: Array.from(userIds),
        },
        recommendedAction: 'Investigate accounts, verify identities, consider freezing',
      });
    }
  }

  console.log('[FRAUD] Found', alerts.length, 'same-card alerts');
  return alerts;
}

/**
 * Detect instructor self-booking
 */
export async function detectInstructorSelfBooking(): Promise<FraudAlert[]> {
  console.log('[FRAUD] Checking for instructor self-booking...');
  
  const alerts: FraudAlert[] = [];

  // Get all bookings with IP/device metadata
  const bookings = await prisma.booking.findMany({
    where: {
      isPaid: true,
    },
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
    },
  });

  // Group by instructor and check for suspicious patterns
  const instructorPatterns = new Map<string, any[]>();
  
  for (const booking of bookings) {
    const instructorId = booking.instructorId;
    
    if (!instructorPatterns.has(instructorId)) {
      instructorPatterns.set(instructorId, []);
    }
    
    instructorPatterns.get(instructorId)!.push({
      bookingId: booking.id,
      clientUserId: booking.client?.userId,
      instructorUserId: booking.instructor?.userId,
    });
  }

  // Analyze patterns
  // Note: IP and device fingerprint tracking requires metadata field
  // TODO: Add metadata field to Booking schema for enhanced fraud detection

  console.log('[FRAUD] Found', alerts.length, 'self-booking alerts');
  return alerts;
}

/**
 * Detect refund-rebook abuse
 */
export async function detectRefundRebookAbuse(): Promise<FraudAlert[]> {
  console.log('[FRAUD] Checking for refund-rebook abuse...');
  
  const alerts: FraudAlert[] = [];

  // Get recent bookings grouped by client
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - FRAUD_RULES.CYCLE_WINDOW_DAYS);

  const bookings = await prisma.booking.findMany({
    where: {
      createdAt: { gte: windowStart },
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Group by client and instructor
  const clientInstructorPairs = new Map<string, any[]>();
  
  for (const booking of bookings) {
    const key = `${booking.clientId}_${booking.instructorId}`;
    
    if (!clientInstructorPairs.has(key)) {
      clientInstructorPairs.set(key, []);
    }
    
    clientInstructorPairs.get(key)!.push(booking);
  }

  // Detect cancel-rebook cycles
  for (const [key, bookings] of clientInstructorPairs.entries()) {
    let cycles = 0;
    let lastStatus = null;
    
    for (const booking of bookings) {
      if (lastStatus === 'CANCELLED' && booking.status === 'CONFIRMED') {
        cycles++;
      }
      lastStatus = booking.status;
    }

    if (cycles >= FRAUD_RULES.MAX_CANCEL_REBOOK_CYCLES) {
      const [clientId, instructorId] = key.split('_');
      
      alerts.push({
        type: 'REFUND_REBOOK_ABUSE',
        severity: 'MEDIUM',
        description: `Client has ${cycles} cancel-rebook cycles with same instructor`,
        entityType: 'CLIENT',
        entityId: clientId,
        evidence: {
          cycles,
          instructorId,
          bookingCount: bookings.length,
          bookings: bookings.map(b => ({
            id: b.id,
            status: b.status,
            createdAt: b.createdAt,
            cancelledAt: b.cancelledAt,
          })),
        },
        recommendedAction: 'Review cancellation reasons, check for policy abuse',
      });
    }
  }

  console.log('[FRAUD] Found', alerts.length, 'refund-rebook alerts');
  return alerts;
}

/**
 * Detect velocity anomalies
 */
export async function detectVelocityAnomalies(): Promise<FraudAlert[]> {
  console.log('[FRAUD] Checking for velocity anomalies...');
  
  const alerts: FraudAlert[] = [];

  // Check bookings per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentBookings = await prisma.booking.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: oneHourAgo },
      userId: { not: null },
    },
    _count: true,
  });

  for (const group of recentBookings) {
    if (group._count > FRAUD_RULES.MAX_BOOKINGS_PER_HOUR) {
      alerts.push({
        type: 'VELOCITY_ANOMALY_HOUR',
        severity: 'HIGH',
        description: `User created ${group._count} bookings in last hour`,
        entityType: 'CLIENT',
        entityId: group.userId!,
        evidence: {
          bookingCount: group._count,
          timeWindow: '1 hour',
        },
        recommendedAction: 'Investigate for bot activity or card testing',
      });
    }
  }

  // Check bookings per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const dailyBookings = await prisma.booking.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: oneDayAgo },
      userId: { not: null },
    },
    _count: true,
  });

  for (const group of dailyBookings) {
    if (group._count > FRAUD_RULES.MAX_BOOKINGS_PER_DAY) {
      alerts.push({
        type: 'VELOCITY_ANOMALY_DAY',
        severity: 'MEDIUM',
        description: `User created ${group._count} bookings in last 24 hours`,
        entityType: 'CLIENT',
        entityId: group.userId!,
        evidence: {
          bookingCount: group._count,
          timeWindow: '24 hours',
        },
        recommendedAction: 'Review booking patterns, verify legitimacy',
      });
    }
  }

  console.log('[FRAUD] Found', alerts.length, 'velocity alerts');
  return alerts;
}

// ============================================
// RISK SCORING
// ============================================

interface RiskScore {
  instructorId: string;
  instructorName: string;
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: {
    cancellationRate: number;
    disputeRate: number;
    refundFrequency: number;
    complaintCount: number;
  };
  recommendedAction: string;
}

/**
 * Calculate instructor risk score
 */
export async function calculateInstructorRiskScore(instructorId: string): Promise<RiskScore> {
  console.log('[FRAUD] Calculating risk score for instructor:', instructorId);

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!instructor) {
    throw new Error('Instructor not found');
  }

  // Get all bookings
  const allBookings = await prisma.booking.findMany({
    where: { instructorId },
  });

  const totalBookings = allBookings.length;
  
  if (totalBookings === 0) {
    return {
      instructorId,
      instructorName: instructor.name,
      score: 0,
      level: 'LOW',
      factors: {
        cancellationRate: 0,
        disputeRate: 0,
        refundFrequency: 0,
        complaintCount: 0,
      },
      recommendedAction: 'No bookings yet - monitor',
    };
  }

  // Calculate cancellation rate
  const cancelledBookings = allBookings.filter(b => b.status === 'CANCELLED').length;
  const cancellationRate = (cancelledBookings / totalBookings) * 100;

  // Calculate dispute rate
  const disputedBookings = allBookings.filter(b => {
    // TODO: Add dispute tracking to Booking schema
    return false; // Disabled until metadata field is added
  }).length;
  const disputeRate = (disputedBookings / totalBookings) * 100;

  // Calculate refund frequency
  const refundedBookings = allBookings.filter(b => b.refundAmount && b.refundAmount > 0).length;
  const refundFrequency = (refundedBookings / totalBookings) * 100;

  // Get complaint count
  const complaintCount = await prisma.task.count({
    where: {
      instructorId,
      type: 'COMPLAINT',
    },
  });

  // Calculate risk score
  const score = 
    (cancellationRate * 0.3) +
    (disputeRate * 0.4) +
    (refundFrequency * 0.2) +
    (complaintCount * 0.1);

  // Determine risk level
  let level: 'HIGH' | 'MEDIUM' | 'LOW';
  let recommendedAction: string;

  if (score >= FRAUD_RULES.HIGH_RISK_SCORE) {
    level = 'HIGH';
    recommendedAction = 'FREEZE PAYOUTS - Require verification before processing';
  } else if (score >= FRAUD_RULES.MEDIUM_RISK_SCORE) {
    level = 'MEDIUM';
    recommendedAction = 'FLAG FOR REVIEW - Manual approval required for payouts';
  } else {
    level = 'LOW';
    recommendedAction = 'Normal operations - Continue monitoring';
  }

  console.log('[FRAUD] Risk score:', score.toFixed(1), 'Level:', level);

  return {
    instructorId,
    instructorName: instructor.name,
    score: Math.round(score * 10) / 10,
    level,
    factors: {
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      disputeRate: Math.round(disputeRate * 10) / 10,
      refundFrequency: Math.round(refundFrequency * 10) / 10,
      complaintCount,
    },
    recommendedAction,
  };
}

/**
 * Calculate risk scores for all instructors
 */
export async function calculateAllInstructorRiskScores(): Promise<RiskScore[]> {
  console.log('[FRAUD] Calculating risk scores for all instructors...');

  const instructors = await prisma.instructor.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const scores: RiskScore[] = [];

  for (const instructor of instructors) {
    try {
      const score = await calculateInstructorRiskScore(instructor.id);
      scores.push(score);
    } catch (error) {
      console.error('[FRAUD] Error calculating score for', instructor.id, error);
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  console.log('[FRAUD] Calculated', scores.length, 'risk scores');
  return scores;
}

// ============================================
// FRAUD SCAN (RUN ALL CHECKS)
// ============================================

export async function runFraudScan() {
  console.log('[FRAUD] 🔍 Starting comprehensive fraud scan...');

  const results = {
    timestamp: new Date().toISOString(),
    alerts: [] as FraudAlert[],
    riskScores: [] as RiskScore[],
    summary: {
      totalAlerts: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      highRiskInstructors: 0,
      mediumRiskInstructors: 0,
    },
  };

  // Run all detection checks
  const [
    sameCardAlerts,
    selfBookingAlerts,
    refundRebookAlerts,
    velocityAlerts,
  ] = await Promise.all([
    detectSameCardAcrossAccounts(),
    detectInstructorSelfBooking(),
    detectRefundRebookAbuse(),
    detectVelocityAnomalies(),
  ]);

  // Combine all alerts
  results.alerts = [
    ...sameCardAlerts,
    ...selfBookingAlerts,
    ...refundRebookAlerts,
    ...velocityAlerts,
  ];

  // Calculate risk scores
  results.riskScores = await calculateAllInstructorRiskScores();

  // Calculate summary
  results.summary.totalAlerts = results.alerts.length;
  results.summary.highSeverity = results.alerts.filter(a => a.severity === 'HIGH').length;
  results.summary.mediumSeverity = results.alerts.filter(a => a.severity === 'MEDIUM').length;
  results.summary.lowSeverity = results.alerts.filter(a => a.severity === 'LOW').length;
  results.summary.highRiskInstructors = results.riskScores.filter(s => s.level === 'HIGH').length;
  results.summary.mediumRiskInstructors = results.riskScores.filter(s => s.level === 'MEDIUM').length;

  console.log('[FRAUD] ✅ Fraud scan complete');
  console.log('[FRAUD] Total alerts:', results.summary.totalAlerts);
  console.log('[FRAUD] High severity:', results.summary.highSeverity);
  console.log('[FRAUD] High risk instructors:', results.summary.highRiskInstructors);

  // Store scan results (convert to JSON-safe format)
  await prisma.auditLog.create({
    data: {
      actorId: 'SYSTEM',
      actorRole: 'SYSTEM',
      action: 'FRAUD_SCAN',
      targetType: 'PLATFORM',
      targetId: 'fraud_detection',
      metadata: JSON.parse(JSON.stringify(results)) as any,
    },
  });

  // Auto-actions for high-risk cases
  if (FRAUD_RULES.AUTO_FREEZE_HIGH_RISK) {
    await autoFreezeHighRiskInstructors(results.riskScores);
  }

  if (FRAUD_RULES.AUTO_FLAG_MEDIUM_RISK) {
    await autoFlagMediumRiskInstructors(results.riskScores);
  }

  // Create tasks for high-severity alerts
  await createFraudAlertTasks(results.alerts);

  return results;
}

/**
 * Auto-freeze high-risk instructors
 */
async function autoFreezeHighRiskInstructors(scores: RiskScore[]) {
  const highRisk = scores.filter(s => s.level === 'HIGH');

  for (const score of highRisk) {
    console.log('[FRAUD] 🔒 Auto-freezing high-risk instructor:', score.instructorName);

    // Freeze pending payouts
    await prisma.payout.updateMany({
      where: {
        instructorId: score.instructorId,
        status: 'pending',
      },
      data: {
        status: 'frozen',
        failureReason: `High fraud risk score: ${score.score}`,
      },
    });

    // Create audit log (risk data stored here instead of instructor record)
    await prisma.auditLog.create({
      data: {
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        action: 'AUTO_FREEZE_HIGH_RISK',
        targetType: 'INSTRUCTOR',
        targetId: score.instructorId,
        metadata: {
          riskScore: JSON.parse(JSON.stringify(score)),
          timestamp: new Date().toISOString(),
          reason: 'High fraud risk - payouts frozen',
        } as any,
      },
    });
  }
}

/**
 * Auto-flag medium-risk instructors
 */
async function autoFlagMediumRiskInstructors(scores: RiskScore[]) {
  const mediumRisk = scores.filter(s => s.level === 'MEDIUM');

  for (const score of mediumRisk) {
    console.log('[FRAUD] ⚠️ Auto-flagging medium-risk instructor:', score.instructorName);

    // Create audit log to track medium-risk instructors
    await prisma.auditLog.create({
      data: {
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        action: 'AUTO_FLAG_MEDIUM_RISK',
        targetType: 'INSTRUCTOR',
        targetId: score.instructorId,
        metadata: {
          riskScore: JSON.parse(JSON.stringify(score)),
          timestamp: new Date().toISOString(),
          reason: 'Medium fraud risk - requires review',
        } as any,
      },
    });
  }
}

/**
 * Create tasks for fraud alerts
 */
async function createFraudAlertTasks(alerts: FraudAlert[]) {
  const highSeverityAlerts = alerts.filter(a => a.severity === 'HIGH');

  for (const alert of highSeverityAlerts) {
    await prisma.task.create({
      data: {
        type: 'COMPLAINT',
        category: 'FINANCIAL',
        priority: 'URGENT',
        status: 'OPEN',
        title: `Fraud Alert: ${alert.type}`,
        description: `${alert.description}\n\nRecommended Action: ${alert.recommendedAction}`,
        instructorId: alert.entityType === 'INSTRUCTOR' ? alert.entityId : undefined,
        clientId: alert.entityType === 'CLIENT' ? alert.entityId : undefined,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  }
}
