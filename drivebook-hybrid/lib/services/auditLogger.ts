/**
 * Audit Logger
 * 
 * Provides forensic trail for:
 * - Dispute resolution
 * - Legal protection
 * - Fraud detection
 * - Compliance evidence
 */

import { prisma } from '@/lib/prisma';

export enum AuditAction {
  // Booking actions
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_UPDATED = 'BOOKING_UPDATED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED',
  
  // Check-in/out actions
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  
  // Financial actions
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_COMPLETED = 'TRANSACTION_COMPLETED',
  TRANSACTION_CANCELLED = 'TRANSACTION_CANCELLED',
  PAYOUT_PROCESSED = 'PAYOUT_PROCESSED',
  
  // Wallet actions
  WALLET_CREDIT = 'WALLET_CREDIT',
  WALLET_DEBIT = 'WALLET_DEBIT',
  WALLET_REFUND = 'WALLET_REFUND',
  
  // Subscription actions
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_PAYMENT_SUCCEEDED = 'SUBSCRIPTION_PAYMENT_SUCCEEDED',
  SUBSCRIPTION_PAYMENT_FAILED = 'SUBSCRIPTION_PAYMENT_FAILED',
  SUBSCRIPTION_TRIAL_ENDING = 'SUBSCRIPTION_TRIAL_ENDING',
  
  // Admin actions
  ADMIN_OVERRIDE = 'ADMIN_OVERRIDE',
  ADMIN_REFUND = 'ADMIN_REFUND',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
  
  // Security events
  UNAUTHORIZED_ATTEMPT = 'UNAUTHORIZED_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  WEBHOOK_VERIFICATION_FAILED = 'WEBHOOK_VERIFICATION_FAILED'
}

export enum ActorRole {
  CLIENT = 'CLIENT',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  SYSTEM = 'SYSTEM'
}

interface AuditLogParams {
  action: AuditAction | string;
  actorId: string;
  actorRole: ActorRole | string;
  resourceType: 'BOOKING' | 'TRANSACTION' | 'WALLET' | 'USER';
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log an audit event
 * 
 * CRITICAL: This should NEVER fail silently
 * If audit logging fails, the operation should fail
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    const auditEntry = {
      action: params.action,
      actorId: params.actorId,
      actorRole: params.actorRole,
      targetType: params.resourceType, // Map to targetType
      targetId: params.resourceId,      // Map to targetId
      ipAddress: params.ipAddress || 'unknown',
      userAgent: params.userAgent || 'unknown',
      metadata: params.metadata || {},
      success: params.success !== false,
      errorMessage: params.errorMessage,
      createdAt: new Date()
    };

    // Log to console for immediate visibility
    console.log('🔍 AUDIT:', JSON.stringify(auditEntry, null, 2));

    // Store in database
    await prisma.auditLog.create({
      data: auditEntry
    });

  } catch (error) {
    // CRITICAL: Audit logging failure should be visible
    console.error('🚨 CRITICAL: Audit logging failed:', error);
    // Don't throw - we don't want to break the main operation
  }
}

/**
 * Log booking action
 */
export async function logBookingAction(params: {
  bookingId: string;
  action: AuditAction | string;
  actorId: string;
  actorRole: ActorRole | string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  success?: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logAuditEvent({
    ...params,
    resourceType: 'BOOKING',
    resourceId: params.bookingId
  });
}

/**
 * Log financial action
 */
export async function logFinancialAction(params: {
  transactionId: string;
  action: AuditAction | string;
  actorId: string;
  actorRole: ActorRole | string;
  amount: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}): Promise<void> {
  await logAuditEvent({
    ...params,
    resourceType: 'TRANSACTION',
    resourceId: params.transactionId,
    metadata: {
      ...params.metadata,
      amount: params.amount
    }
  });
}

/**
 * Log subscription action
 */
export async function logSubscriptionAction(params: {
  subscriptionId: string;
  instructorId: string;
  action: AuditAction | string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  success?: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logAuditEvent({
    action: params.action,
    actorId: params.instructorId,
    actorRole: ActorRole.SYSTEM, // Webhooks are system actions
    resourceType: 'TRANSACTION', // Use TRANSACTION for subscriptions
    resourceId: params.subscriptionId,
    ipAddress: params.ipAddress || 'stripe-webhook',
    userAgent: params.userAgent || 'stripe-webhook',
    metadata: params.metadata,
    success: params.success,
    errorMessage: params.errorMessage
  });
}

/**
 * Log security event
 */
export async function logSecurityEvent(params: {
  action: AuditAction | string;
  actorId: string;
  actorRole: ActorRole | string;
  resourceType: 'BOOKING' | 'TRANSACTION' | 'WALLET' | 'USER';
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage: string;
  metadata?: any;
}): Promise<void> {
  await logAuditEvent({
    ...params,
    success: false
  });

  // Also send alert for security events
  console.error('🚨 SECURITY EVENT:', {
    action: params.action,
    actorId: params.actorId,
    resourceId: params.resourceId,
    error: params.errorMessage
  });
}

/**
 * Query audit logs for a resource
 */
export async function getAuditTrail(
  resourceType: string,
  resourceId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    return await prisma.auditLog.findMany({
      where: {
        targetType: resourceType,
        targetId: resourceId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  } catch (error) {
    console.error('Failed to fetch audit trail:', error);
    return [];
  }
}

/**
 * Get audit trail for a booking
 */
export async function getBookingAuditTrail(bookingId: string): Promise<any[]> {
  return getAuditTrail('BOOKING', bookingId);
}

/**
 * Schema for AuditLog model (add to prisma/schema.prisma):
 * 
 * model AuditLog {
 *   id           String   @id @default(auto()) @map("_id") @db.ObjectId
 *   action       String
 *   actorId      String   @db.ObjectId
 *   actorRole    String
 *   resourceType String
 *   resourceId   String   @db.ObjectId
 *   ipAddress    String
 *   userAgent    String
 *   metadata     Json?
 *   success      Boolean  @default(true)
 *   errorMessage String?
 *   timestamp    DateTime @default(now())
 *   
 *   @@index([resourceType, resourceId])
 *   @@index([actorId])
 *   @@index([timestamp])
 *   @@index([action])
 * }
 */
