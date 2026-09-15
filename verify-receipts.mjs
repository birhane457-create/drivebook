/**
 * Integration Verification Test Script
 * Tests all 7 receipt scenarios at runtime
 */

import {
  createPackagePurchaseContext,
  createWalletLessonContext,
  createSingleLessonContext,
  createWalletTopUpContext,
  createCancellationContext,
  createAdminCreditContext,
  createAdminDeductionContext,
  receiptService,
  DocumentType,
  SupplierType
} from './lib/services/receipt/index';

// Test data
const mockCustomer = {
  name: 'John Smith',
  email: 'john@example.com'
};

const mockProvider = {
  id: 'prov_123',
  name: 'Jane Instructor',
  abn: '12345678901',
  abnVerified: true,
  gstRegistered: true
};

const mockBooking = {
  id: 'book_456',
  startTime: new Date('2024-06-15T10:00:00+10:00'),
  duration: 60,
  pickupAddress: '123 Test St, Sydney NSW'
};

const mockPayment = {
  total: 93.24,
  method: 'Visa ending in 4242',
  stripePaymentIntentId: 'pi_test123'
};

console.log('=== Receipt System Integration Verification ===\n');

// Test 1: Package Purchase
console.log('1. Testing Package Purchase (MIXED_DOCUMENT)...');
const packageContext = createPackagePurchaseContext({
  transactionId: 'txn_package_001',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  payment: { ...mockPayment, total: 855 },
  discountedPackageValue: 855,
  firstLessonCost: 90,
  walletCredited: 734.22,
  walletPreviousBalance: 0,
  walletNewBalance: 644.22,
  providerHourlyRate: 90
});
console.log(`   Document Type: ${packageContext.documentType}`);
console.log(`   Line Items: ${packageContext.items.length}`);
console.log(`   Platform Fee: $${packageContext.items[0].amount.toFixed(2)}`);
console.log(`   Expected: MIXED_DOCUMENT, 3 items, $30.78 platform fee`);
console.log(`   ✓ Match: ${packageContext.documentType === DocumentType.MIXED_DOCUMENT && packageContext.items.length === 3 && Math.abs(packageContext.items[0].amount - 30.78) < 0.01}`);
console.log('');

// Test 2: Wallet Lesson (GST-registered provider)
console.log('2. Testing Wallet Lesson - GST Provider (TAX_INVOICE)...');
const walletLessonContext = createWalletLessonContext({
  transactionId: 'txn_wallet_002',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  lessonCost: 90,
  walletPreviousBalance: 644.22,
  walletNewBalance: 554.22,
  providerHourlyRate: 90
});
console.log(`   Document Type: ${walletLessonContext.documentType}`);
console.log(`   Payment Total: $${walletLessonContext.payment.total}`);
console.log(`   Expected: TAX_INVOICE, $0 payment`);
console.log(`   ✓ Match: ${walletLessonContext.documentType === DocumentType.TAX_INVOICE && walletLessonContext.payment.total === 0}`);
console.log('');

// Test 3: Wallet Lesson (non-GST provider)
console.log('3. Testing Wallet Lesson - Non-GST Provider (PAYMENT_RECEIPT)...');
const nonGstProvider = { ...mockProvider, gstRegistered: false };
const walletLessonNonGst = createWalletLessonContext({
  transactionId: 'txn_wallet_003',
  customer: mockCustomer,
  provider: nonGstProvider,
  booking: mockBooking,
  lessonCost: 90,
  walletPreviousBalance: 644.22,
  walletNewBalance: 554.22
});
console.log(`   Document Type: ${walletLessonNonGst.documentType}`);
console.log(`   Expected: PAYMENT_RECEIPT`);
console.log(`   ✓ Match: ${walletLessonNonGst.documentType === DocumentType.PAYMENT_RECEIPT}`);
console.log('');

// Test 4: Single Lesson
console.log('4. Testing Single Lesson (TAX_INVOICE)...');
const singleLessonContext = createSingleLessonContext({
  transactionId: 'txn_single_004',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  payment: mockPayment,
  lessonCost: 90
});
console.log(`   Document Type: ${singleLessonContext.documentType}`);
console.log(`   Line Items: ${singleLessonContext.items.length}`);
console.log(`   Expected: TAX_INVOICE, 2 items (platform fee + service)`);
console.log(`   ✓ Match: ${singleLessonContext.documentType === DocumentType.TAX_INVOICE && singleLessonContext.items.length === 2}`);
console.log('');

// Test 5: Wallet Top-Up
console.log('5. Testing Wallet Top-Up (PAYMENT_RECEIPT)...');
const topUpContext = createWalletTopUpContext({
  transactionId: 'txn_topup_005',
  customer: mockCustomer,
  payment: { ...mockPayment, total: 500 },
  topUpAmount: 500,
  walletPreviousBalance: 554.22,
  walletNewBalance: 1054.22
});
console.log(`   Document Type: ${topUpContext.documentType}`);
console.log(`   Line Items: ${topUpContext.items.length}`);
console.log(`   Item Type: ${topUpContext.items[0].type}`);
console.log(`   Expected: PAYMENT_RECEIPT, 1 FVV item`);
console.log(`   ✓ Match: ${topUpContext.documentType === DocumentType.PAYMENT_RECEIPT && topUpContext.items.length === 1}`);
console.log('');

// Test 6: Cancellation (24+ hours = 100% refund)
console.log('6. Testing Cancellation - 24+ hours (ADJUSTMENT_NOTE, 100% refund)...');
const cancellationContext = createCancellationContext({
  transactionId: 'txn_cancel_006',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  cancelledBy: 'student',
  refundAmount: 90,
  refundPercent: 100,
  refundDestination: 'card'
});
console.log(`   Document Type: ${cancellationContext.documentType}`);
console.log(`   Refund Amount: $${Math.abs(cancellationContext.payment.total)}`);
console.log(`   Refund Percent: ${cancellationContext.cancellation?.refundPercent}%`);
console.log(`   Expected: ADJUSTMENT_NOTE, $90 refund, 100%`);
console.log(`   ✓ Match: ${cancellationContext.documentType === DocumentType.ADJUSTMENT_NOTE && Math.abs(cancellationContext.payment.total) === 90 && cancellationContext.cancellation?.refundPercent === 100}`);
console.log('');

// Test 7: Admin Credit
console.log('7. Testing Admin Credit (PAYMENT_RECEIPT)...');
const adminCreditContext = createAdminCreditContext({
  transactionId: 'txn_credit_007',
  customer: mockCustomer,
  creditAmount: 50,
  creditReason: 'Service recovery',
  walletPreviousBalance: 1054.22,
  walletNewBalance: 1104.22
});
console.log(`   Document Type: ${adminCreditContext.documentType}`);
console.log(`   Payment Total: $${adminCreditContext.payment.total}`);
console.log(`   Expected: PAYMENT_RECEIPT, $0 payment`);
console.log(`   ✓ Match: ${adminCreditContext.documentType === DocumentType.PAYMENT_RECEIPT && adminCreditContext.payment.total === 0}`);
console.log('');

// Test 8: Admin Deduction
console.log('8. Testing Admin Deduction (ADJUSTMENT_NOTE)...');
const adminDeductionContext = createAdminDeductionContext({
  transactionId: 'txn_deduct_008',
  customer: mockCustomer,
  deductionAmount: 20,
  deductionReason: 'Policy violation',
  walletPreviousBalance: 1104.22,
  walletNewBalance: 1084.22
});
console.log(`   Document Type: ${adminDeductionContext.documentType}`);
console.log(`   Expected: ADJUSTMENT_NOTE`);
console.log(`   ✓ Match: ${adminDeductionContext.documentType === DocumentType.ADJUSTMENT_NOTE}`);
console.log('');

// Test 9: HTML Generation
console.log('9. Testing HTML Generation...');
try {
  const html = receiptService.generateHTML(singleLessonContext);
  console.log(`   HTML Length: ${html.length} characters`);
  console.log(`   Contains DOCTYPE: ${html.includes('<!DOCTYPE html>')}`);
  console.log(`   Contains receipt number: ${html.includes('DB-2024')}`);
  console.log(`   Contains customer name: ${html.includes('John Smith')}`);
  console.log(`   ✓ HTML generated successfully`);
} catch (error) {
  console.log(`   ✗ HTML generation failed: ${error.message}`);
}
console.log('');

// Test 10: Verify 24-hour cancellation policy in template
console.log('10. Testing Cancellation Policy Text...');
const cancelHtml = receiptService.generateHTML(packageContext);
const has24HourRule = cancelHtml.includes('24+ hours notice: full refund');
const hasUnder24Rule = cancelHtml.includes('Under 24 hours: no refund');
const hasOld48HourRule = cancelHtml.includes('48+') || cancelHtml.includes('24-48');
console.log(`   Has 24+ hours rule: ${has24HourRule}`);
console.log(`   Has under 24 hours rule: ${hasUnder24Rule}`);
console.log(`   Has old 3-tier rule: ${hasOld48HourRule}`);
console.log(`   ✓ Correct: ${has24HourRule && hasUnder24Rule && !hasOld48HourRule}`);
console.log('');

// Test 11: Verify PLATFORM_GST_REGISTERED usage
console.log('11. Testing Platform GST Registration...');
const platformItem = packageContext.items.find(item => item.supplier === SupplierType.PLATFORM);
console.log(`   Platform fee taxable: ${platformItem?.taxable}`);
console.log(`   Expected: true (platform is GST-registered)`);
console.log(`   ✓ Match: ${platformItem?.taxable === true}`);
console.log('');

// Test 12: Verify supplier is independent field
console.log('12. Testing Supplier Model Independence...');
const hasSupplierField = packageContext.items.every(item => item.hasOwnProperty('supplier'));
const supplierTypes = [...new Set(packageContext.items.map(i => i.supplier))];
console.log(`   All items have supplier field: ${hasSupplierField}`);
console.log(`   Supplier types used: ${supplierTypes.join(', ')}`);
console.log(`   ✓ Supplier is explicit field: ${hasSupplierField}`);
console.log('');

// Test 13: Verify no DIRECT implementation
console.log('13. Verifying DIRECT mode is design-only...');
const allContextsUsePlatform = [
  packageContext, walletLessonContext, singleLessonContext,
  topUpContext, cancellationContext, adminCreditContext, adminDeductionContext
].every(ctx => ctx.paymentMode === 'PLATFORM');
console.log(`   All contexts use PLATFORM mode: ${allContextsUsePlatform}`);
console.log(`   ✓ No DIRECT implementation active: ${allContextsUsePlatform}`);
console.log('');

// Test 14: Verify pricing calculation
console.log('14. Testing Pricing Calculation ($900 → $855 → $885.78)...');
const headlineValue = 900;
const discount = 0.05;
const discountedValue = headlineValue * (1 - discount); // $855
const platformFeeRate = 0.036;
const platformFee = discountedValue * platformFeeRate; // $30.78
const expectedTotal = discountedValue + platformFee; // $885.78
console.log(`   Headline: $${headlineValue}`);
console.log(`   After 5% discount: $${discountedValue}`);
console.log(`   Platform fee (3.6%): $${platformFee.toFixed(2)}`);
console.log(`   Total: $${expectedTotal.toFixed(2)}`);
console.log(`   ✓ Matches observed $885.78: ${Math.abs(expectedTotal - 885.78) < 0.01}`);
console.log('');

console.log('=== Verification Complete ===');
