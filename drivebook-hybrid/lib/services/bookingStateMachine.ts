/**
 * Booking State Machine
 * 
 * Enforces valid state transitions to prevent:
 * - Impossible state changes
 * - Fraud attempts
 * - Data corruption
 */

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * Valid state transitions
 * 
 * PENDING → CONFIRMED (payment received)
 * CONFIRMED → CHECKED_IN (lesson started)
 * CONFIRMED → CANCELLED (before lesson)
 * CHECKED_IN → COMPLETED (lesson finished)
 * CHECKED_IN → CANCELLED (emergency cancellation)
 * 
 * Terminal states: COMPLETED, CANCELLED
 */
export const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CHECKED_IN,
    BookingStatus.CANCELLED
  ],
  [BookingStatus.CHECKED_IN]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED // Emergency only
  ],
  [BookingStatus.COMPLETED]: [], // Terminal state
  [BookingStatus.CANCELLED]: []  // Terminal state
};

/**
 * Validate if a state transition is allowed
 */
export function validateTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  // Normalize status strings
  const current = currentStatus as BookingStatus;
  const next = newStatus as BookingStatus;

  // Check if current status is valid
  if (!VALID_TRANSITIONS[current]) {
    return {
      valid: false,
      error: `Invalid current status: ${currentStatus}`
    };
  }

  // Check if transition is allowed
  const allowedTransitions = VALID_TRANSITIONS[current];
  if (!allowedTransitions.includes(next)) {
    return {
      valid: false,
      error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Get allowed next states for a booking
 */
export function getAllowedNextStates(currentStatus: string): BookingStatus[] {
  const current = currentStatus as BookingStatus;
  return VALID_TRANSITIONS[current] || [];
}

/**
 * Check if a status is terminal (no further transitions allowed)
 */
export function isTerminalState(status: string): boolean {
  const bookingStatus = status as BookingStatus;
  return VALID_TRANSITIONS[bookingStatus]?.length === 0;
}

/**
 * Get human-readable transition error message
 */
export function getTransitionErrorMessage(
  currentStatus: string,
  attemptedStatus: string
): string {
  const allowed = getAllowedNextStates(currentStatus);
  
  if (isTerminalState(currentStatus)) {
    return `Cannot modify ${currentStatus} booking. This booking is finalized.`;
  }

  return `Cannot change booking from ${currentStatus} to ${attemptedStatus}. ` +
         `Allowed transitions: ${allowed.join(', ')}`;
}
