/**
 * Booking State Machine
 * 
 * Centralized state transition validation for all booking routes.
 * Prevents invalid status changes and ensures data integrity.
 * 
 * Related: BOOKING_FLOW_AUDIT #1, #20
 */

export type BookingStatus = 
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

/**
 * Allowed state transitions for each booking status
 * Terminal states (COMPLETED, CANCELLED) have no outbound transitions unless admin override
 */
export const BOOKING_STATE_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state (admin can override)
  NO_SHOW: ['COMPLETED'], // Admin can resolve dispute
  EXPIRED: ['CANCELLED'], // Auto-transition only
};

export interface StateTransitionContext {
  isAdmin: boolean;
  reason?: string;
  allowAdminOverride?: boolean;
}

export interface StateTransitionResult {
  valid: boolean;
  error?: string;
  requiresAdminOverride?: boolean;
}

/**
 * Validate a booking status transition
 * 
 * @param from - Current booking status
 * @param to - Target booking status
 * @param context - Execution context (admin privileges, reason, etc.)
 * @returns Validation result with error message if invalid
 */
export function validateStateTransition(
  from: BookingStatus,
  to: BookingStatus,
  context: StateTransitionContext = { isAdmin: false }
): StateTransitionResult {
  // Same status = no transition
  if (from === to) {
    return { valid: true };
  }
  
  const allowedTransitions = BOOKING_STATE_TRANSITIONS[from] || [];
  
  // Admin override for dispute resolution and special cases
  if (context.isAdmin && context.allowAdminOverride) {
    // Allow admin to resolve NO_SHOW disputes
    if (from === 'NO_SHOW' && to === 'COMPLETED') {
      return { valid: true };
    }
    
    // Allow admin to reinstate CANCELLED bookings
    if (from === 'CANCELLED' && to === 'CONFIRMED') {
      return { valid: true };
    }
    
    // Block nonsensical admin transitions
    if (from === 'COMPLETED' && to !== 'COMPLETED') {
      return { 
        valid: false, 
        error: 'Cannot modify a completed booking. Completed bookings are immutable for financial record-keeping. Create a new booking instead.' 
      };
    }
  }
  
  // Check if transition is allowed by state machine
  if (!allowedTransitions.includes(to)) {
    const allowedStr = allowedTransitions.length > 0 
      ? allowedTransitions.join(', ') 
      : 'none (terminal state)';
    
    return {
      valid: false,
      error: `Invalid state transition: ${from} → ${to}. Allowed transitions from ${from}: ${allowedStr}`,
      requiresAdminOverride: context.isAdmin && ['NO_SHOW', 'CANCELLED'].includes(from),
    };
  }
  
  return { valid: true };
}

/**
 * Check if a status is a terminal state (no outbound transitions)
 */
export function isTerminalStatus(status: BookingStatus): boolean {
  return ['COMPLETED', 'CANCELLED'].includes(status);
}

/**
 * Check if a status is a pending state (awaiting confirmation)
 */
export function isPendingStatus(status: BookingStatus): boolean {
  return ['PENDING', 'PENDING_PAYMENT'].includes(status);
}

/**
 * Check if a status is an active state (can be worked on)
 */
export function isActiveStatus(status: BookingStatus): boolean {
  return ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'].includes(status);
}

/**
 * Get all terminal statuses
 */
export function getTerminalStatuses(): BookingStatus[] {
  return ['COMPLETED', 'CANCELLED'];
}
