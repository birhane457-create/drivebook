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
  PENDING_PAYMENT = 'PENDING_PAYMENT', // created, awaiting Stripe payment
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',   // payment not received within window
  NO_SHOW = 'NO_SHOW'    // client did not attend
}

/**
 * Valid state transitions
 *
 * PENDING         → PENDING_PAYMENT (payment intent created)
 * PENDING         → CONFIRMED       (offline/wallet booking — no card needed)
 * PENDING         → CANCELLED
 * PENDING_PAYMENT → CONFIRMED       (Stripe payment_intent.succeeded)
 * PENDING_PAYMENT → CANCELLED       (user cancelled before paying)
 * PENDING_PAYMENT → EXPIRED         (payment window elapsed)
 * CONFIRMED       → CHECKED_IN      (lesson started)
 * CONFIRMED       → CANCELLED       (cancelled before lesson)
 * CONFIRMED       → NO_SHOW         (client did not attend)
 * CHECKED_IN      → COMPLETED       (lesson finished)
 * CHECKED_IN      → CANCELLED       (emergency cancellation)
 *
 * Terminal states: COMPLETED, CANCELLED, EXPIRED, NO_SHOW
 */
export const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED
  ],
  [BookingStatus.PENDING_PAYMENT]: [
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CHECKED_IN,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW
  ],
  [BookingStatus.CHECKED_IN]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED
  ],
  [BookingStatus.COMPLETED]: [],  // Terminal
  [BookingStatus.CANCELLED]: [],  // Terminal
  [BookingStatus.EXPIRED]: [],    // Terminal
  [BookingStatus.NO_SHOW]: []     // Terminal
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
