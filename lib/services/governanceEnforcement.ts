import { prisma } from '@/lib/prisma';
import {
  canApproveRefund,
  calculateRefundAmount,
  canCloseTask,
  checkSLABreach,
  calculateFinancialImpact,
  REFUND_POLICY,
  TASK_CLOSURE_REQUIREMENTS,
  SLA_RULES,
  ESCALATION_RULES,
} from '@/lib/config/governance';

/**
 * GOVERNANCE ENFORCEMENT SERVICE
 * 
 * This service enforces all governance rules and prevents
 * unauthorized actions.
 */

// ============================================
// REFUND GOVERNANCE (CONTROL #1 & #3)
// ============================================

interface ProcessRefundParams {
  staffId: string;
  taskId: string;
  bookingId: string;
  clientId: string;
  bookingAmount: number;
  hoursUntilBooking: number;
  manualOverride?: boolean;
  overrideAmount?: number;
  justification: string;
}

export async function processRefundWithGovernance(params: ProcessRefundParams) {
  const {
    staffId,
    taskId,
    bookingId,
    clientId,
    bookingAmount,
    hoursUntilBooking,
    manualOverride = false,
    overrideAmount,
    justification,
  } = params;

  // 1. Get staff permissions
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffId },
  });

  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (!staff.canApproveRefunds) {
    throw new Error('Staff member does not have refund approval permission');
  }

  // 2. Calculate refund amount (SYSTEM-CALCULATED)
  const calculatedRefund = calculateRefundAmount(bookingAmount, hoursUntilBooking);
  let finalRefundAmount = calculatedRefund.amount;
  let requiresApproval = false;
  let approvalReason = '';

  // 3. Check for manual override
  if (manualOverride && overrideAmount !== undefined) {
    if (!REFUND_POLICY.ALLOW_MANUAL_OVERRIDE) {
      throw new Error('Manual refund overrides are not allowed by policy');
    }

    if (!staff.canOverridePolicy) {
      throw new Error('Staff member cannot override refund policy');
    }

    const overrideDifference = Math.abs(overrideAmount - calculatedRefund.amount);
    if (overrideDifference > REFUND_POLICY.MAX_OVERRIDE_AMOUNT) {
      throw new Error(
        `Override amount exceeds limit. Max override: $${REFUND_POLICY.MAX_OVERRIDE_AMOUNT}`
      );
    }

    finalRefundAmount = overrideAmount;
    requiresApproval = true;
    approvalReason = 'Manual policy override';
  }

  // 4. Check justification
  if (REFUND_POLICY.REQUIRE_JUSTIFICATION) {
    if (!justification || justification.length < REFUND_POLICY.MIN_JUSTIFICATION_LENGTH) {
      throw new Error(
        `Justification required (min ${REFUND_POLICY.MIN_JUSTIFICATION_LENGTH} characters)`
      );
    }
  }

  // 5. Check approval authority
  const approvalCheck = canApproveRefund(staff, finalRefundAmount);

  if (!approvalCheck.canApprove) {
    requiresApproval = true;
    if (approvalCheck.requiresOwner) {
      approvalReason = 'Amount exceeds supervisor limit - requires owner approval';
    } else if (approvalCheck.requiresSupervisor) {
      approvalReason = 'Amount exceeds staff limit - requires supervisor approval';
    }
  }

  // 6. Calculate financial impact
  const financialImpact = calculateFinancialImpact({
    grossAmount: finalRefundAmount,
  });

  // 7. Update task with governance data
  await prisma.task.update({
    where: { id: taskId },
    data: {
      financialAmount: finalRefundAmount,
      financialImpact,
      requiresApproval,
      status: requiresApproval ? 'WAITING_RESPONSE' : 'IN_PROGRESS',
    },
  });

  // 8. Create audit log
  await createAuditLog({
    action: 'REFUND_PROCESSED',
    staffId,
    taskId,
    bookingId,
    clientId,
    amount: finalRefundAmount,
    metadata: {
      calculatedAmount: calculatedRefund.amount,
      calculatedPercentage: calculatedRefund.percentage,
      calculatedReason: calculatedRefund.reason,
      finalAmount: finalRefundAmount,
      manualOverride,
      justification,
      requiresApproval,
      approvalReason,
      financialImpact,
    },
  });

  return {
    success: !requiresApproval,
    refundAmount: finalRefundAmount,
    requiresApproval,
    approvalReason,
    financialImpact,
    message: requiresApproval
      ? `Refund request submitted for approval: ${approvalReason}`
      : 'Refund processed successfully',
  };
}

// ============================================
// TASK CLOSURE GOVERNANCE (CONTROL #2)
// ============================================

export async function closeTaskWithGovernance(params: {
  taskId: string;
  staffId: string;
  resolution: string;
}) {
  const { taskId, staffId, resolution } = params;

  // 1. Get staff permissions
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffId },
  });

  if (!staff) {
    throw new Error('Staff member not found');
  }

  // 2. Check if staff can close tasks
  if (!staff.isSupervisor && !TASK_CLOSURE_REQUIREMENTS.STAFF_CAN_CLOSE_OWN) {
    throw new Error('Only supervisors can close tasks');
  }

  // 3. Get task with all required data
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      notes: true,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // 4. Check if task can be closed
  const closureCheck = canCloseTask(task);

  if (!closureCheck.canClose) {
    throw new Error(`Cannot close task: ${closureCheck.reason}`);
  }

  // 5. Verify linked entities if required
  if (TASK_CLOSURE_REQUIREMENTS.VERIFY_LINKED_ENTITIES && !task.linkedEntityVerified) {
    // Verify booking exists
    if (task.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: task.bookingId },
      });
      if (!booking) {
        throw new Error('Linked booking not found - cannot close task');
      }
    }

    // Verify client exists
    if (task.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: task.clientId },
      });
      if (!client) {
        throw new Error('Linked client not found - cannot close task');
      }
    }

    // Mark as verified
    await prisma.task.update({
      where: { id: taskId },
      data: { linkedEntityVerified: true },
    });
  }

  // 6. Close the task
  const closedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'CLOSED',
      resolution,
      closedBy: staffId,
      closedAt: new Date(),
    },
  });

  // 7. Decrement staff load
  if (task.assignedToId) {
    await prisma.staffMember.update({
      where: { id: task.assignedToId },
      data: { currentLoad: { decrement: 1 } },
    });
  }

  // 8. Create audit log
  await createAuditLog({
    action: 'TASK_CLOSED',
    staffId,
    taskId,
    metadata: {
      resolution,
      taskType: task.type,
      category: task.category,
      financialAmount: task.financialAmount,
    },
  });

  return closedTask;
}

// ============================================
// SLA MONITORING & ESCALATION (CONTROL #5)
// ============================================

export async function checkAndEscalateTasks() {
  // Get all open and in-progress tasks
  const tasks = await prisma.task.findMany({
    where: {
      status: {
        in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'],
      },
    },
    include: {
      assignedTo: true,
    },
  });

  const escalations = [];

  for (const task of tasks) {
    // Check SLA breach
    const slaCheck = checkSLABreach(
      task.priority as 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW',
      task.createdAt,
      task.firstResponseAt,
      task.resolvedAt
    );

    if (slaCheck.breached) {
      // Mark as breached
      await prisma.task.update({
        where: { id: task.id },
        data: {
          slaBreached: true,
          slaBreachReason: slaCheck.reason,
        },
      });

      // Auto-escalate if enabled
      if (ESCALATION_RULES.AUTO_ESCALATE) {
        const escalationResult = await escalateTask({
          taskId: task.id,
          reason: `SLA breached: ${slaCheck.reason} (${Math.round(slaCheck.minutesOverdue || 0)} min overdue)`,
          autoEscalated: true,
        });

        escalations.push(escalationResult);
      }
    }
  }

  return escalations;
}

export async function escalateTask(params: {
  taskId: string;
  reason: string;
  autoEscalated?: boolean;
  escalateTo?: string;
}) {
  const { taskId, reason, autoEscalated = false, escalateTo } = params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Find supervisor to escalate to
  let supervisorId = escalateTo;

  if (!supervisorId && task.assignedTo) {
    // Find supervisor for this staff member
    const supervisor = await prisma.staffMember.findFirst({
      where: {
        isSupervisor: true,
        department: task.assignedTo.department,
        isActive: true,
      },
    });

    if (supervisor) {
      supervisorId = supervisor.id;
    }
  }

  // Update task
  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      escalatedAt: new Date(),
      escalatedTo: supervisorId,
      escalationReason: reason,
      escalationCount: { increment: 1 },
      autoEscalated,
      status: 'ESCALATED',
    },
  });

  // Create audit log
  await createAuditLog({
    action: 'TASK_ESCALATED',
    taskId,
    metadata: {
      reason,
      autoEscalated,
      escalatedTo: supervisorId,
      escalationCount: updatedTask.escalationCount,
    },
  });

  // TODO: Send notification to supervisor

  return updatedTask;
}

// ============================================
// AUDIT LOGGING
// ============================================

interface AuditLogParams {
  action: string;
  staffId?: string;
  taskId?: string;
  bookingId?: string;
  clientId?: string;
  instructorId?: string;
  amount?: number;
  metadata?: any;
}

async function createAuditLog(params: AuditLogParams) {
  const { action, staffId, taskId, bookingId, clientId, instructorId, amount, metadata } = params;

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      actorId: staffId || 'SYSTEM',
      actorRole: staffId ? 'STAFF' : 'SYSTEM',
      action,
      targetType: taskId ? 'TASK' : bookingId ? 'BOOKING' : 'OTHER',
      targetId: taskId || bookingId || 'N/A',
      metadata: {
        ...metadata,
        amount,
        clientId,
        instructorId,
        timestamp: new Date().toISOString(),
      } as any,
    },
  });
}

// ============================================
// PERMISSION CHECKS
// ============================================

export async function checkStaffPermission(
  staffId: string,
  permission: keyof typeof import('@/lib/config/governance').STAFF_PERMISSIONS.FINANCIAL
): Promise<boolean> {
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffId },
  });

  if (!staff) {
    return false;
  }

  // Check specific permission
  return (staff as any)[permission] === true;
}

export async function enforcePermission(
  staffId: string,
  permission: string,
  errorMessage?: string
) {
  const hasPermission = await checkStaffPermission(staffId, permission as any);

  if (!hasPermission) {
    throw new Error(errorMessage || `Permission denied: ${permission}`);
  }
}
