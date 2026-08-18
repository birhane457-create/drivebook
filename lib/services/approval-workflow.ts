/**
 * Approval Workflow Service
 * 
 * Two-person integrity for high-value admin operations.
 * Prevents single admin from processing large payouts, subscription overrides, etc.
 */

import { prisma } from '@/lib/prisma'

// Cast to any to allow pendingApproval table access before migration runs
const db = prisma as any

export type ApprovalActionType =
  | 'PAYOUT_PROCESS'              // Single payout processing
  | 'PAYOUT_PROCESS_BATCH'        // Batch payout processing
  | 'SUBSCRIPTION_OVERRIDE'       // Force change subscription tier/status
  | 'WALLET_LARGE_CREDIT'         // Wallet credit over threshold
  | 'WALLET_LARGE_DEDUCT'         // Wallet debit over threshold
  | 'PRICING_CHANGE'              // Platform commission rate change
  | 'SETTINGS_CRITICAL'           // Critical platform settings change
  | 'INSTRUCTOR_PERMANENT_BAN'    // Permanent suspension (vs temporary)

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

export interface ApprovalRequest {
  actionType: ApprovalActionType
  targetType: string
  targetId: string
  requestedBy: string
  requestedByName?: string
  requestedByEmail?: string
  requestData: Record<string, any>
  reason?: string
  expiresInHours?: number // Default 24h
}

export interface ApprovalDecision {
  approvalId: string
  decidedBy: string
  decidedByName?: string
  decidedByEmail?: string
  approved: boolean
  reason?: string
}

// ── Configuration ─────────────────────────────────────────────────────────────

const APPROVAL_THRESHOLDS = {
  // Financial thresholds that trigger approval
  WALLET_CREDIT_THRESHOLD: 500,    // Credits over $500 need approval
  WALLET_DEDUCT_THRESHOLD: 500,    // Debits over $500 need approval
  PAYOUT_THRESHOLD: 1000,          // Payouts over $1000 need approval
  
  // Expiry times (hours)
  DEFAULT_EXPIRY: 24,              // 24 hours for most approvals
  FINANCIAL_EXPIRY: 48,            // 48 hours for financial operations
  SETTINGS_EXPIRY: 72,             // 72 hours for settings changes
} as const

// ── Core Functions ────────────────────────────────────────────────────────────

export class ApprovalWorkflowService {
  /**
   * Create a pending approval request
   */
  static async createApproval(request: ApprovalRequest): Promise<string> {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + (request.expiresInHours || APPROVAL_THRESHOLDS.DEFAULT_EXPIRY))

    const approval = await db.pendingApproval.create({
      data: {
        actionType: request.actionType,
        targetType: request.targetType,
        targetId: request.targetId,
        requestedBy: request.requestedBy,
        requestedByName: request.requestedByName,
        requestedByEmail: request.requestedByEmail,
        requestData: request.requestData as any,
        reason: request.reason,
        status: 'PENDING',
        expiresAt,
      },
    })

    // Log creation
    await prisma.auditLog.create({
      data: {
        action: 'APPROVAL_REQUESTED',
        actorId: request.requestedBy,
        actorRole: 'ADMIN',
        targetType: 'PENDING_APPROVAL',
        targetId: approval.id,
        success: true,
        metadata: {
          actionType: request.actionType,
          targetId: request.targetId,
          reason: request.reason,
        } as any,
      },
    })

    // TODO: Send notification to approvers
    // await notifyApproversNeeded(approval.id, request.actionType)

    return approval.id
  }

  /**
   * Approve a pending request
   */
  static async approve(decision: ApprovalDecision): Promise<{
    success: boolean
    approval: any
    canExecute: boolean
    message: string
  }> {
    const approval = await db.pendingApproval.findUnique({
      where: { id: decision.approvalId },
    })

    if (!approval) {
      throw new Error('Approval request not found')
    }

    // Validate state
    if (approval.status !== 'PENDING') {
      throw new Error(`Cannot approve: status is ${approval.status}`)
    }

    // Check expiry
    if (new Date() > new Date(approval.expiresAt)) {
      await db.pendingApproval.update({
        where: { id: decision.approvalId },
        data: { status: 'EXPIRED' },
      })
      throw new Error('Approval request has expired')
    }

    // Prevent self-approval
    if (approval.requestedBy === decision.decidedBy) {
      throw new Error('Cannot approve your own request')
    }

    // Update approval status
    const updated = await db.pendingApproval.update({
      where: { id: decision.approvalId },
      data: {
        status: decision.approved ? 'APPROVED' : 'REJECTED',
        ...(decision.approved ? {
          approvedBy: decision.decidedBy,
          approvedByName: decision.decidedByName,
          approvedByEmail: decision.decidedByEmail,
          approvedAt: new Date(),
        } : {
          rejectedBy: decision.decidedBy,
          rejectedByName: decision.decidedByName,
          rejectedByEmail: decision.decidedByEmail,
          rejectedAt: new Date(),
          rejectionReason: decision.reason,
        }),
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: decision.approved ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
        actorId: decision.decidedBy,
        actorRole: 'ADMIN',
        targetType: 'PENDING_APPROVAL',
        targetId: decision.approvalId,
        success: true,
        metadata: {
          actionType: approval.actionType,
          originalRequester: approval.requestedBy,
          reason: decision.reason,
        } as any,
      },
    })

    // TODO: Notify original requester
    // await notifyApprovalDecision(approval.requestedBy, decision.approved, decision.reason)

    return {
      success: true,
      approval: updated,
      canExecute: decision.approved,
      message: decision.approved
        ? 'Request approved. You can now execute the action.'
        : 'Request rejected.',
    }
  }

  /**
   * Get pending approvals for review
   */
  static async getPendingApprovals(filters?: {
    actionType?: ApprovalActionType
    requestedBy?: string
    limit?: number
  }): Promise<any[]> {
    return await db.pendingApproval.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        ...(filters?.actionType && { actionType: filters.actionType }),
        ...(filters?.requestedBy && { requestedBy: filters.requestedBy }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    })
  }

  /**
   * Check if action requires approval
   */
  static requiresApproval(actionType: ApprovalActionType, data?: any): boolean {
    switch (actionType) {
      case 'PAYOUT_PROCESS':
        return data?.amount > APPROVAL_THRESHOLDS.PAYOUT_THRESHOLD
      
      case 'PAYOUT_PROCESS_BATCH':
        return true // Always require approval for batch
      
      case 'WALLET_LARGE_CREDIT':
        return data?.amount > APPROVAL_THRESHOLDS.WALLET_CREDIT_THRESHOLD
      
      case 'WALLET_LARGE_DEDUCT':
        return data?.amount > APPROVAL_THRESHOLDS.WALLET_DEDUCT_THRESHOLD
      
      case 'SUBSCRIPTION_OVERRIDE':
      case 'PRICING_CHANGE':
      case 'SETTINGS_CRITICAL':
      case 'INSTRUCTOR_PERMANENT_BAN':
        return true // Always require approval
      
      default:
        return false
    }
  }

  /**
   * Validate approval before executing action
   */
  static async validateApproval(approvalId: string): Promise<{
    valid: boolean
    approval?: any
    reason?: string
  }> {
    const approval = await db.pendingApproval.findUnique({
      where: { id: approvalId },
    })

    if (!approval) {
      return { valid: false, reason: 'Approval not found' }
    }

    if (approval.status !== 'APPROVED') {
      return { valid: false, reason: `Status is ${approval.status}, not APPROVED` }
    }

    if (new Date() > new Date(approval.expiresAt)) {
      return { valid: false, reason: 'Approval has expired' }
    }

    return { valid: true, approval }
  }

  /**
   * Cancel a pending approval (by requester only)
   */
  static async cancel(approvalId: string, cancelledBy: string): Promise<void> {
    const approval = await db.pendingApproval.findUnique({
      where: { id: approvalId },
    })

    if (!approval) {
      throw new Error('Approval not found')
    }

    if (approval.requestedBy !== cancelledBy) {
      throw new Error('Only the requester can cancel')
    }

    if (approval.status !== 'PENDING') {
      throw new Error(`Cannot cancel: status is ${approval.status}`)
    }

    await db.pendingApproval.update({
      where: { id: approvalId },
      data: { status: 'CANCELLED' },
    })

    await prisma.auditLog.create({
      data: {
        action: 'APPROVAL_CANCELLED',
        actorId: cancelledBy,
        actorRole: 'ADMIN',
        targetType: 'PENDING_APPROVAL',
        targetId: approvalId,
        success: true,
      },
    })
  }

  /**
   * Cleanup expired approvals (run via cron)
   */
  static async expireOldApprovals(): Promise<number> {
    const result = await db.pendingApproval.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })

    return result.count
  }
}

// ── Helper: Check if amount requires approval ────────────────────────────────

export function requiresApprovalForAmount(
  actionType: 'credit' | 'debit' | 'payout',
  amount: number
): boolean {
  switch (actionType) {
    case 'credit':
      return amount > APPROVAL_THRESHOLDS.WALLET_CREDIT_THRESHOLD
    case 'debit':
      return amount > APPROVAL_THRESHOLDS.WALLET_DEDUCT_THRESHOLD
    case 'payout':
      return amount > APPROVAL_THRESHOLDS.PAYOUT_THRESHOLD
    default:
      return false
  }
}
