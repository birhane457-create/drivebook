/**
 * Email service mock for integration tests
 * Prevents actual SMTP connections during test execution
 */

import { vi } from 'vitest';

// Mock the email service module before any imports
vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    sendPDATestReminder: vi.fn().mockResolvedValue(undefined),
    sendTestEmail: vi.fn().mockResolvedValue({ success: true, message: 'Test email sent' }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    sendGenericEmail: vi.fn().mockResolvedValue(undefined),
    sendReceipt: vi.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendInstructorSetupEmail: vi.fn().mockResolvedValue(undefined),
    sendClaimAccountEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock receipt email functions
vi.mock('@/lib/services/receipt-email', () => ({
  sendSingleLessonReceipt: vi.fn().mockResolvedValue(undefined),
  sendPackagePurchaseReceipt: vi.fn().mockResolvedValue(undefined),
  sendWalletTopUpReceipt: vi.fn().mockResolvedValue(undefined),
}));

console.log('📧 Email service mocked for integration tests');
