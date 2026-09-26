import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Audit Log Service
 * Tracks all critical admin and system actions for compliance and debugging
 */

// ─── Tier guarantee levels ────────────────────────────────────────────────────
//
// TIER 1 — Critical financial operations (booking confirmed, wallet debited)
// TIER 2 — Security-sensitive admin mutations (subscription override, cancellation)
// TIER 3 — Subscription webhook mutations inside Serializable transactions
//   Fix: writeAuditLog(tx, ...) — audit written atomically with state change.
//   On serialization retry, the audit rolls back and is re-written with the
//   transaction. No duplicate entries because recordWebhookEvent idempotency
//   key is also inside the same transaction.
//
// TIER 4 — Non-critical/diagnostic events (card order, trial reminder, etc.)
//   Fix: writeAuditLogSafe(...) — uses module-level prisma (not tx), does NOT
//   throw on failure. Failure is logged at ERROR level and explicitly documented
//   as acceptable here. This replaces the silent catch blocks from auditLogger.ts.
//
// ─── Migration guide ──────────────────────────────────────────────────────────
//
// OLD (AUDIT-01 defect — swallows errors):
//   try { await logBookingAction({ ... }) } catch { }
//
// NEW Tier 1/2/3 (atomic, throws on failure → rolls back parent transaction):
//   await writeAuditLog(tx, { action: '...', actorId: '...', actorRole: '...',
//     targetType: '...', targetId: '...', metadata: {...} })
//
// NEW Tier 4 (non-blocking, logs failure explicitly):
//   await writeAuditLogSafe({ action: '...', actorId: '...', actorRole: '...',
//     targetType: '...', targetId: '...', metadata: {...} })

// ─── Raw schema-level write types ────────────────────────────────────────────

export interface AuditEntryData {
  action:       string;
  actorId:      string;
  actorRole:    string;
  targetType:   string;
  targetId:     string;
  ipAddress?:   string | null;
  userAgent?:   string | null;
  metadata?:    Record<string, unknown>;
  success?:     boolean;
  errorMessage?: string | null;
}

/**
 * writeAuditLog — Tier 1 / 2 / 3
 *
 * Writes an audit entry atomically within the provided Prisma transaction
 * client. If the write fails, the error propagates and rolls back the
 * parent transaction — the state change is never committed without its
 * audit record.
 *
 * MUST be called with the transaction client (tx), not the module-level
 * prisma instance. Using module-level prisma inside a $transaction callback
 * silently breaks atomicity because the write runs on a separate connection.
 */
export async function writeAuditLog(
  tx: any, // Prisma transaction client — enforced by call sites
  data: AuditEntryData,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action:       data.action,
      actorId:      data.actorId,
      actorRole:    data.actorRole,
      targetType:   data.targetType,
      targetId:     data.targetId,
      ipAddress:    data.ipAddress   ?? null,
      userAgent:    data.userAgent   ?? null,
      metadata:     data.metadata    ?? {},
      success:      data.success     ?? true,
      errorMessage: data.errorMessage ?? null,
    },
  });
}

/**
 * writeAuditLogSafe — Tier 4
 *
 * Writes an audit entry using the module-level prisma client (not inside a
 * transaction). Does NOT throw on failure — audit failure is logged at ERROR
 * level and the caller continues.
 *
 * Use ONLY for non-critical diagnostic events where:
 *   a) The operation has no financial or access-control consequence, OR
 *   b) The failure policy has been explicitly reviewed and accepted here.
 *
 * Do NOT use this for financial state changes or security-sensitive mutations.
 */
export async function writeAuditLogSafe(data: AuditEntryData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:       data.action,
        actorId:      data.actorId,
        actorRole:    data.actorRole,
        targetType:   data.targetType,
        targetId:     data.targetId,
        ipAddress:    data.ipAddress   ?? null,
        userAgent:    data.userAgent   ?? null,
        metadata:     (data.metadata ?? {}) as any,
        success:      data.success     ?? true,
        errorMessage: data.errorMessage ?? null,
      },
    });
  } catch (err) {
    // AUDIT-01 fix: non-critical audit failure is explicitly documented here.
    // The caller has been reviewed and accepts that this audit entry may be
    // missing in rare DB-failure scenarios. All critical paths use writeAuditLog
    // (with tx) instead. This catch must NEVER be copied to critical paths.
    logger.error('Non-critical audit log write failed', {
      action:   data.action,
      actorId:  data.actorId,
      targetId: data.targetId,
      error:    err instanceof Error ? err.message : String(err),
    });
  }
}

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
  | 'provider'
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
      actorId: adminId,
      actorRole: adminId === 'SYSTEM' ? 'SYSTEM' : 'ADMIN',
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

  await prisma.auditLog.create({
    data: {
      action,
      actorId: adminId,
      actorRole: adminId === 'SYSTEM' ? 'SYSTEM' : 'ADMIN',
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

  if (filters.adminId) where.actorId = filters.adminId;
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  return prisma.auditLog.findMany({
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
  return prisma.auditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get recent admin activity
 */
export async function getRecentAdminActivity(adminId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { actorId: adminId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get system-wide audit statistics
 */
export async function getAuditStatistics(startDate: Date, endDate: Date) {
  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const actionCounts: Record<string, number> = {};
  const adminCounts: Record<string, number> = {};

  logs.forEach((log) => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    adminCounts[log.actorId] = (adminCounts[log.actorId] || 0) + 1;
  });

  return {
    totalActions: logs.length,
    actionBreakdown: actionCounts,
    adminActivity: adminCounts,
    period: { startDate, endDate },
  };
}
