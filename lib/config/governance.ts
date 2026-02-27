/**
 * GOVERNANCE CONFIGURATION
 * 
 * This file defines the operational rules and authority limits
 * for the staff management system.
 * 
 * ⚠️ CRITICAL: Changes to these values affect financial controls
 * and must be approved by platform owner.
 */

// ============================================
// FINANCIAL AUTHORITY LIMITS (CONTROL #1)
// ============================================

export const REFUND_APPROVAL_THRESHOLDS = {
  // Staff can approve refunds up to this amount without supervisor
  STAFF_LIMIT: 100,
  
  // Senior staff/supervisor can approve up to this amount
  SUPERVISOR_LIMIT: 500,
  
  // Anything above this requires owner approval
  OWNER_APPROVAL_REQUIRED: 500,
} as const;

export const PAYOUT_APPROVAL_THRESHOLDS = {
  STAFF_LIMIT: 200,
  SUPERVISOR_LIMIT: 1000,
  OWNER_APPROVAL_REQUIRED: 1000,
} as const;

export const WALLET_ADJUSTMENT_THRESHOLDS = {
  STAFF_LIMIT: 50,
  SUPERVISOR_LIMIT: 200,
  OWNER_APPROVAL_REQUIRED: 200,
} as const;

// ============================================
// REFUND POLICY ENFORCEMENT (CONTROL #3)
// ============================================

export const REFUND_POLICY = {
  // Cancellation refund percentages (SYSTEM-CALCULATED, NOT MANUAL)
  CANCELLATION_48H_PLUS: 1.0, // 100% refund
  CANCELLATION_24H_TO_48H: 0.5, // 50% refund
  CANCELLATION_UNDER_24H: 0.0, // 0% refund
  
  // Can staff override these calculations?
  ALLOW_MANUAL_OVERRIDE: false, // Set to true only if owner approves
  
  // If override allowed, what's the limit?
  MAX_OVERRIDE_AMOUNT: 50, // Staff can add up to $50 goodwill refund PER BOOKING
  
  // Monthly override cap PER STAFF MEMBER
  MONTHLY_OVERRIDE_CAP_PER_STAFF: 200, // Max $200 in overrides per staff per month
  
  // Require justification for any refund?
  REQUIRE_JUSTIFICATION: true,
  MIN_JUSTIFICATION_LENGTH: 20, // characters
} as const;

// ============================================
// TASK CLOSURE REQUIREMENTS (CONTROL #2)
// ============================================

export const TASK_CLOSURE_REQUIREMENTS = {
  // Must have resolution text?
  REQUIRE_RESOLUTION: true,
  MIN_RESOLUTION_LENGTH: 30, // characters
  
  // Must verify linked entities exist?
  VERIFY_LINKED_ENTITIES: true,
  
  // Must have at least one note?
  REQUIRE_NOTES: true,
  
  // Financial tasks must have financial impact recorded?
  REQUIRE_FINANCIAL_IMPACT: true,
  
  // Who can close tasks?
  STAFF_CAN_CLOSE_OWN: false, // Staff can only resolve, not close
  SUPERVISOR_CAN_CLOSE: true,
  ADMIN_CAN_CLOSE: true,
} as const;

// ============================================
// PERMISSION MATRIX (CONTROL #4)
// ============================================

export const STAFF_PERMISSIONS = {
  FINANCIAL: {
    canApproveRefunds: true,
    refundApprovalLimit: REFUND_APPROVAL_THRESHOLDS.STAFF_LIMIT,
    canProcessPayouts: true,
    payoutApprovalLimit: PAYOUT_APPROVAL_THRESHOLDS.STAFF_LIMIT,
    canModifyWallet: false, // Only supervisor can modify wallet directly
    canOverridePolicy: false,
    canCancelBookings: false,
    canModifyBookingData: false,
    canAccessLogs: false,
    canAccessIntegrations: false,
  },
  
  TECHNICAL: {
    canApproveRefunds: false,
    refundApprovalLimit: 0,
    canProcessPayouts: false,
    payoutApprovalLimit: 0,
    canModifyWallet: false,
    canOverridePolicy: false,
    canCancelBookings: false,
    canModifyBookingData: false,
    canAccessLogs: true,
    canAccessIntegrations: true,
  },
  
  SUPPORT: {
    canApproveRefunds: false,
    refundApprovalLimit: 0,
    canProcessPayouts: false,
    payoutApprovalLimit: 0,
    canModifyWallet: false,
    canOverridePolicy: false,
    canCancelBookings: true, // Can cancel if policy allows
    canModifyBookingData: false,
    canAccessLogs: false,
    canAccessIntegrations: false,
  },
  
  SUPERVISOR: {
    canApproveRefunds: true,
    refundApprovalLimit: REFUND_APPROVAL_THRESHOLDS.SUPERVISOR_LIMIT,
    canProcessPayouts: true,
    payoutApprovalLimit: PAYOUT_APPROVAL_THRESHOLDS.SUPERVISOR_LIMIT,
    canModifyWallet: true,
    canOverridePolicy: true,
    canCancelBookings: true,
    canModifyBookingData: true,
    canAccessLogs: true,
    canAccessIntegrations: true,
  },
} as const;

// ============================================
// SLA & ESCALATION RULES (CONTROL #5)
// ============================================

export const SLA_RULES = {
  URGENT: {
    responseTime: 15, // minutes - must start within 15 min
    resolutionTime: 60, // minutes - must resolve within 1 hour
    escalateAfter: 30, // minutes - escalate if not started
    notifyAll: true, // Notify all staff immediately
  },
  
  HIGH: {
    responseTime: 30, // minutes
    resolutionTime: 240, // minutes (4 hours)
    escalateAfter: 120, // minutes (2 hours)
    notifyAll: false,
  },
  
  NORMAL: {
    responseTime: 120, // minutes (2 hours)
    resolutionTime: 1440, // minutes (24 hours)
    escalateAfter: 720, // minutes (12 hours)
    notifyAll: false,
  },
  
  LOW: {
    responseTime: 480, // minutes (8 hours)
    resolutionTime: 4320, // minutes (3 days)
    escalateAfter: 2880, // minutes (2 days)
    notifyAll: false,
  },
} as const;

export const ESCALATION_RULES = {
  // Auto-escalate if SLA breached?
  AUTO_ESCALATE: true,
  
  // Escalation hierarchy
  ESCALATION_LEVELS: [
    {
      level: 1,
      name: 'Supervisor',
      role: 'SUPERVISOR',
      notifyAfterMinutes: 30, // Escalate to Level 2 if no response in 30min
    },
    {
      level: 2,
      name: 'Owner/Admin',
      role: 'ADMIN',
      notifyAfterMinutes: 60, // Escalate to Level 3 if no response in 1h
    },
    {
      level: 3,
      name: 'Emergency Override',
      role: 'SUPER_ADMIN',
      notifyAfterMinutes: 0, // Final level - no further escalation
    },
  ],
  
  // Notify owner for certain task types?
  NOTIFY_OWNER_FOR: [
    'PAYMENT_DISPUTE',
    'COMPLAINT',
  ],
  
  // Max escalation attempts before emergency mode
  MAX_ESCALATIONS: 3,
  
  // Emergency override mode (when all escalations exhausted)
  EMERGENCY_MODE: {
    enabled: true,
    notifyEmails: [process.env.OWNER_EMAIL, process.env.EMERGENCY_EMAIL],
    notifySMS: [process.env.OWNER_PHONE],
  },
} as const;

// ============================================
// AUDIT REQUIREMENTS
// ============================================

export const AUDIT_REQUIREMENTS = {
  // Log all financial actions?
  LOG_FINANCIAL_ACTIONS: true,
  
  // Require dual control for large amounts?
  DUAL_CONTROL_THRESHOLD: 500,
  
  // Retain audit logs for how long?
  AUDIT_RETENTION_DAYS: 2555, // 7 years
  
  // Actions that require audit log
  AUDITABLE_ACTIONS: [
    'REFUND_PROCESSED',
    'PAYOUT_PROCESSED',
    'WALLET_MODIFIED',
    'POLICY_OVERRIDDEN',
    'BOOKING_CANCELLED',
    'TASK_CLOSED',
  ],
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if staff member can approve a refund
 */
export function canApproveRefund(
  staffPermissions: { refundApprovalLimit: number },
  amount: number
): { canApprove: boolean; requiresSupervisor: boolean; requiresOwner: boolean } {
  if (amount <= staffPermissions.refundApprovalLimit) {
    return { canApprove: true, requiresSupervisor: false, requiresOwner: false };
  }
  
  if (amount <= REFUND_APPROVAL_THRESHOLDS.SUPERVISOR_LIMIT) {
    return { canApprove: false, requiresSupervisor: true, requiresOwner: false };
  }
  
  return { canApprove: false, requiresSupervisor: false, requiresOwner: true };
}

/**
 * Calculate refund amount based on policy (SYSTEM-CALCULATED)
 */
export function calculateRefundAmount(
  bookingAmount: number,
  hoursUntilBooking: number
): { amount: number; percentage: number; reason: string } {
  if (hoursUntilBooking >= 48) {
    return {
      amount: bookingAmount * REFUND_POLICY.CANCELLATION_48H_PLUS,
      percentage: 100,
      reason: 'Cancelled 48+ hours before booking',
    };
  }
  
  if (hoursUntilBooking >= 24) {
    return {
      amount: bookingAmount * REFUND_POLICY.CANCELLATION_24H_TO_48H,
      percentage: 50,
      reason: 'Cancelled 24-48 hours before booking',
    };
  }
  
  return {
    amount: bookingAmount * REFUND_POLICY.CANCELLATION_UNDER_24H,
    percentage: 0,
    reason: 'Cancelled less than 24 hours before booking',
  };
}

/**
 * Check if task can be closed
 */
export function canCloseTask(task: {
  resolution?: string | null;
  notes: any[];
  financialAmount?: number | null;
  financialImpact?: any;
  linkedEntityVerified: boolean;
}): { canClose: boolean; reason?: string } {
  if (TASK_CLOSURE_REQUIREMENTS.REQUIRE_RESOLUTION) {
    if (!task.resolution || task.resolution.length < TASK_CLOSURE_REQUIREMENTS.MIN_RESOLUTION_LENGTH) {
      return {
        canClose: false,
        reason: `Resolution text required (min ${TASK_CLOSURE_REQUIREMENTS.MIN_RESOLUTION_LENGTH} characters)`,
      };
    }
  }
  
  if (TASK_CLOSURE_REQUIREMENTS.REQUIRE_NOTES && task.notes.length === 0) {
    return {
      canClose: false,
      reason: 'At least one note is required before closing',
    };
  }
  
  if (TASK_CLOSURE_REQUIREMENTS.REQUIRE_FINANCIAL_IMPACT && task.financialAmount && !task.financialImpact) {
    return {
      canClose: false,
      reason: 'Financial impact must be recorded for financial tasks',
    };
  }
  
  if (TASK_CLOSURE_REQUIREMENTS.VERIFY_LINKED_ENTITIES && !task.linkedEntityVerified) {
    return {
      canClose: false,
      reason: 'Linked entities must be verified before closing',
    };
  }
  
  return { canClose: true };
}

/**
 * Check if task has breached SLA
 */
export function checkSLABreach(
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW',
  createdAt: Date,
  firstResponseAt?: Date | null,
  resolvedAt?: Date | null
): { breached: boolean; reason?: string; minutesOverdue?: number } {
  const now = new Date();
  const sla = SLA_RULES[priority];
  const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
  
  // Check response time SLA
  if (!firstResponseAt && minutesSinceCreation > sla.responseTime) {
    return {
      breached: true,
      reason: 'Response time SLA breached',
      minutesOverdue: minutesSinceCreation - sla.responseTime,
    };
  }
  
  // Check resolution time SLA
  if (!resolvedAt && minutesSinceCreation > sla.resolutionTime) {
    return {
      breached: true,
      reason: 'Resolution time SLA breached',
      minutesOverdue: minutesSinceCreation - sla.resolutionTime,
    };
  }
  
  return { breached: false };
}

/**
 * Calculate financial impact for task
 */
export function calculateFinancialImpact(params: {
  grossAmount: number;
  stripeFeePercent?: number;
  commissionPercent?: number;
}): {
  grossAmount: number;
  stripeFee: number;
  commission: number;
  netInstructorImpact: number;
  netPlatformLoss: number;
} {
  const { grossAmount, stripeFeePercent = 2.9, commissionPercent = 15 } = params;
  
  const stripeFee = grossAmount * (stripeFeePercent / 100);
  const commission = grossAmount * (commissionPercent / 100);
  const netInstructorImpact = grossAmount - commission;
  const netPlatformLoss = commission - stripeFee;
  
  return {
    grossAmount,
    stripeFee,
    commission,
    netInstructorImpact,
    netPlatformLoss,
  };
}

/**
 * Check staff's monthly override usage
 */
export async function checkMonthlyOverrideCap(
  staffId: string,
  proposedOverrideAmount: number
): Promise<{ allowed: boolean; currentMonthTotal: number; remaining: number; reason?: string }> {
  const { prisma } = await import('@/lib/prisma');
  
  // Get start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Get all tasks with overrides by this staff this month
  const tasksWithOverrides = await prisma.task.findMany({
    where: {
      resolvedBy: staffId,
      resolvedAt: { gte: monthStart },
      financialAmount: { gt: 0 },
      // Check metadata for manual override flag
    },
    select: {
      financialAmount: true,
      financialImpact: true,
    },
  });
  
  // Calculate total overrides this month
  let currentMonthTotal = 0;
  for (const task of tasksWithOverrides) {
    const impact = task.financialImpact as any;
    if (impact?.manualOverride) {
      currentMonthTotal += impact.overrideAmount || 0;
    }
  }
  
  const remaining = REFUND_POLICY.MONTHLY_OVERRIDE_CAP_PER_STAFF - currentMonthTotal;
  
  if (currentMonthTotal + proposedOverrideAmount > REFUND_POLICY.MONTHLY_OVERRIDE_CAP_PER_STAFF) {
    return {
      allowed: false,
      currentMonthTotal,
      remaining,
      reason: `Monthly override cap exceeded. Used: $${currentMonthTotal}, Remaining: $${remaining}, Requested: $${proposedOverrideAmount}`,
    };
  }
  
  return {
    allowed: true,
    currentMonthTotal,
    remaining: remaining - proposedOverrideAmount,
  };
}
