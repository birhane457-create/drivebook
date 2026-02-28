/**
 * Data Sanitization Utilities
 * Protects sensitive user data and ensures GDPR compliance
 */

/**
 * Safe client data selector for instructor access
 * Only exposes necessary information, protects PII
 */
export const safeClientSelect = {
  id: true,
  name: true,
  phone: true, // Will be sanitized in response
  createdAt: true,
  // EXCLUDED for privacy:
  // - email (not needed by instructor)
  // - address (sensitive)
  // - dateOfBirth (sensitive)
  // - licenseNumber (sensitive)
  // - userId (internal)
};

/**
 * Safe instructor data selector for client access
 * Only exposes public information
 */
export const safeInstructorSelect = {
  id: true,
  name: true,
  phone: true, // Will be sanitized
  bio: true,
  profileImage: true,
  carImage: true,
  carMake: true,
  carModel: true,
  carYear: true,
  baseAddress: true, // General area only
  hourlyRate: true,
  vehicleTypes: true,
  languages: true,
  averageRating: true,
  totalReviews: true,
  isActive: true,
  isVerified: true,
  isFeatured: true,
  // EXCLUDED for privacy:
  // - email (via user relation)
  // - licenseNumber
  // - insuranceNumber
  // - document URLs
  // - stripeCustomerId
  // - approvalStatus (internal)
};

/**
 * Sanitize phone number - show only last 4 digits
 * Example: "0412345678" -> "****5678"
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '****';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 4) return '****';
  
  // Show last 4 digits only
  return '****' + digits.slice(-4);
}

/**
 * Sanitize email - show only first char and domain
 * Example: "john.doe@example.com" -> "j***@example.com"
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '***@***.***';
  
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';
  
  return `${local[0]}***@${domain}`;
}

/**
 * Sanitize address - show only suburb/city
 * Example: "123 Main St, Springfield, VIC 3000" -> "Springfield, VIC"
 */
export function sanitizeAddress(address: string | null | undefined): string {
  if (!address) return 'Not specified';
  
  // Try to extract suburb and state (Australian format)
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 2) {
    // Return suburb and state only
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(' ')[0]}`;
  }
  
  return 'Location provided';
}

/**
 * Sanitize client data for instructor view
 */
export function sanitizeClientForInstructor(client: any) {
  return {
    ...client,
    phone: sanitizePhone(client.phone),
    // Remove any accidentally included sensitive fields
    email: undefined,
    address: undefined,
    dateOfBirth: undefined,
    licenseNumber: undefined,
    userId: undefined,
  };
}

/**
 * Sanitize instructor data for client view
 */
export function sanitizeInstructorForClient(instructor: any) {
  return {
    ...instructor,
    phone: sanitizePhone(instructor.phone),
    baseAddress: sanitizeAddress(instructor.baseAddress),
    // Remove sensitive fields
    licenseNumber: undefined,
    insuranceNumber: undefined,
    licenseExpiry: undefined,
    insuranceExpiry: undefined,
    policeCheckExpiry: undefined,
    wwcCheckExpiry: undefined,
    licenseImageFront: undefined,
    licenseImageBack: undefined,
    insurancePolicyDoc: undefined,
    policeCheckDoc: undefined,
    wwcCheckDoc: undefined,
    stripeCustomerId: undefined,
    stripeSubscriptionId: undefined,
    stripeAccountId: undefined,
    approvalStatus: undefined,
    approvedBy: undefined,
    rejectionReason: undefined,
  };
}

/**
 * Sanitize booking data - remove sensitive client info
 */
export function sanitizeBookingData(booking: any, viewerRole: 'instructor' | 'client' | 'admin') {
  const sanitized = { ...booking };
  
  if (viewerRole === 'instructor' && booking.client) {
    sanitized.client = sanitizeClientForInstructor(booking.client);
  }
  
  if (viewerRole === 'client' && booking.instructor) {
    sanitized.instructor = sanitizeInstructorForClient(booking.instructor);
  }
  
  // Admin sees everything (but should still be logged)
  
  return sanitized;
}

/**
 * Redact sensitive data from logs
 * Use this before logging user data
 */
export function redactForLogging(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const redacted = { ...data };
  
  // Redact common sensitive fields
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'licenseNumber',
    'insuranceNumber',
  ];
  
  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  // Partially redact email and phone
  if (redacted.email) {
    redacted.email = sanitizeEmail(redacted.email);
  }
  if (redacted.phone) {
    redacted.phone = sanitizePhone(redacted.phone);
  }
  
  return redacted;
}

/**
 * Check if user has permission to access data
 */
export function canAccessClientData(
  requesterId: string,
  requesterRole: string,
  clientId: string,
  instructorId?: string
): boolean {
  // Admin can access all data
  if (requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN') {
    return true;
  }
  
  // Client can access their own data
  if (requesterRole === 'CLIENT' && requesterId === clientId) {
    return true;
  }
  
  // Instructor can access their client's data
  if (requesterRole === 'INSTRUCTOR' && instructorId && requesterId === instructorId) {
    return true;
  }
  
  return false;
}

/**
 * Create data access log entry
 * Required for GDPR compliance - track who accessed what data
 */
export async function logDataAccess(
  prisma: any,
  accessorId: string,
  accessorRole: string,
  dataType: 'CLIENT' | 'INSTRUCTOR' | 'BOOKING' | 'TRANSACTION',
  dataIds: string[],
  action: 'VIEW' | 'EXPORT' | 'MODIFY' | 'DELETE',
  ipAddress?: string | null
) {
  // This would go in a DataAccessLog table (add to schema if needed)
  // For now, we'll use the audit log
  try {
    await (prisma as any).auditLog.create({
      data: {
        action: `DATA_ACCESS_${action}`,
        actorId: accessorId,
        actorRole: accessorRole || 'UNKNOWN',
        targetType: dataType,
        targetId: dataIds[0] || 'multiple',
        metadata: {
          accessorRole,
          dataIds,
          dataCount: dataIds.length,
        },
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to log data access:', error);
    // Don't fail the request if logging fails
  }
}
