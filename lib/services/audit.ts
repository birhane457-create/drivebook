import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Audit Log Service
 * Tracks all critical admin and system actions for compliance and debugging
 */

export type AuditAction =
  // Instructor Management
  | 'APPROVE_INSTRUCTOR'
  | 'REJECT_INSTRUCTOR'
  | 'SUSPEND_INSTRUCTOR'
  | 'REACTIVATE_INSTRUCTOR'
  | 'UPDATE_INSTRUCTOR'
  | 'DELETE_INSTRUCTOR'
  // Payout Management
  | 'PROCESS_PAYOUT'
  | 'PROCESS_BULK_PAYOUT'
  | 'CANCEL_PAYOUT'
  | 'RETRY_PAYOUT'
  // Document Management
  | 'APPROVE_DOCUMENT'
  | 'REJECT_DOCUMENT'
  | 'AUTO_DEACTIVATE_EXPIRED_DOCS'
  // Booking Management
  | 'CANCEL_BOOKING'
  | 'REFUND_BOOKING'
  | 'MODIFY_BOOKING'
  // Client Management
  | 'ADD_WALLET_CREDIT'
  | 'DEDUCT_WALLET_CREDIT'
  | 'ADJUST_WALLET_BALANCE'
  // System Actions
  | 'SYSTEM_AUTO_PROCESS'
  | 'COMPLIANCE_CHECK'
  | 'SEND_NOTIFICATION';

export type AuditTargetType =
  | 'INSTRUCTOR'
  | 'CLIENT'
  | 'BOOKING'
  | 'TRANSACTION'
  | 'PAYOUT'
  | 'DOCUMENT'
  | 'WALLET'
  | 'SYSTEM';

interface AuditLogParams {
  action: AuditAction;
  adminId: string; // User ID or "SYSTEM" for automated actions
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, any>;
  req?: NextRequest;
}

/**
 * Log an admin or system action to the audit trail
 * Use within a Prisma transaction for atomicity
 */
export async function logAuditAction(
  tx: any, // Prisma transaction client
  params: AuditLogParams
): Promise<void> {
  const { action, adminId, targetType, targetId, metadata, req } = params;

  await tx.auditLog.create({
    data: {
      action,
      adminId,
      targetType,
      targetId,
      metadata: metadata || {},
      ipAddress: req?.headers.get('x-forwarded-for') || 
                 req?.headers.get('x-real-ip') || 
                 null,
      userAgent: req?.headers.get('user-agent') || null,
    },
  });
}

/**
 * Log an action outside of a transaction (use sparingly)
 */
export async function logAuditActionStandalone(
  params: AuditLogParams
): Promise<void> {
  const { action, adminId, targetType, targetId, metadata, req } = params;

  await (prisma as any).auditLog.create({
    data: {
      action,
      adminId,
      targetType,
      targetId,
      metadata: metadata || {},
      ipAddress: req?.headers.get('x-forwarded-for') || 
                 req?.headers.get('x-real-ip') || 
                 null,
      userAgent: req?.headers.get('user-agent') || null,
    },
  });
}

/**
 * Query audit logs with filters
 */
export async function getAuditLogs(filters: {
  adminId?: string;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const where: any = {};

  if (filters.adminId) where.adminId = filters.adminId;
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;
  
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  return (prisma as any).auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
  });
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  targetType: AuditTargetType,
  targetId: string
) {
  return (prisma as any).auditLog.findMany({
    where: {
      targetType,
      targetId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get recent admin activity
 */
export async function getRecentAdminActivity(adminId: string, limit = 50) {
  return (prisma as any).auditLog.findMany({
    where: { adminId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get system-wide audit statistics
 */
export async function getAuditStatistics(startDate: Date, endDate: Date) {
  const logs = await (prisma as any).auditLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Group by action
  const actionCounts: Record<string, number> = {};
  const adminCounts: Record<string, number> = {};

  logs.forEach((log: any) => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    adminCounts[log.adminId] = (adminCounts[log.adminId] || 0) + 1;
  });

  return {
    totalActions: logs.length,
    actionBreakdown: actionCounts,
    adminActivity: adminCounts,
    period: { startDate, endDate },
  };
}
