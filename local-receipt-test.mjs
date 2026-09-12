/**
 * LOCAL RECEIPT TESTING SCRIPT
 * 
 * Tests all 7 receipt scenarios by generating HTML and optionally sending emails
 * via local SMTP server (Mailhog, Papercut, etc.)
 */

import { 
  receiptService,
  createPackagePurchaseContext,
  createWalletLessonContext,
  createSingleLessonContext,
  createWalletTopUpContext,
  createCancellationContext,
  createAdminCreditContext,
  createAdminDeductionContext
} from './lib/services/receipt/index';
import { writeFileSync } from 'fs';

// Test configuration
const SEND_EMAILS = process.env.TEST_SEND_EMAILS === 'true';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@localhost';

console.log('=== LOCAL RECEIPT TESTING ===\n');
console.log(`Email sending: ${SEND_EMAILS ? 'ENABLED' : 'DISABLED (HTML only)'}`);
console.log(`Test email: ${TEST_EMAIL}`);
console.log(`SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}\n`);

// Mock data
const customer = { name: 'John Customer', email: TEST_EMAIL };
const provider = {
  id: 'provider_test_001',
  name: 'Jane Instructor',
  businessName: 'Jane\'s Driving School',
  abn: '12 345 678 901',
  abnVerified: true,
  gstRegistered: true
};
const booking = {
  id: 'booking_test_001',
  startTime: new Date('2024-07-15T10:00:00+10:00'),
  duration: 60,
  pickupAddress: '123 Test Street, Sydney NSW 2000'
};

const results = [];

// Test 1: Package Purchase
console.log('1. Testing Package Purchase Receipt...');
try {
  const context = createPackagePurchaseContext({
    transactionId: 'test_pkg_001',
    customer,
    provider,
    booking,
    payment: { total: 885.78, method: 'Visa ending in 4242', stripePaymentIntentId: 'pi_test_package' },
    discountedPackageValue: 855,
    firstLessonCost: 90,
    walletCredited: 734.22,
    walletPreviousBalance: 0,
    walletNewBalance: 644.22,
    providerHourlyRate: 90
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/01-package-purchase.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Package Purchase', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Package Purchase', status: 'HTML', file: '01-package-purchase.html' });
  }
  console.log('   ✓ Package Purchase receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Package Purchase', status: 'FAILED', error: error.message });
}

// Test 2: Wallet Lesson (GST-registered)
console.log('2. Testing Wallet Lesson Receipt (GST provider)...');
try {
  const context = createWalletLessonContext({
    transactionId: 'test_wallet_002',
    customer,
    provider,
    booking,
    lessonCost: 90,
    walletPreviousBalance: 644.22,
    walletNewBalance: 554.22,
    providerHourlyRate: 90
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/02-wallet-lesson-gst.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Wallet Lesson (GST)', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Wallet Lesson (GST)', status: 'HTML', file: '02-wallet-lesson-gst.html' });
  }
  console.log('   ✓ Wallet Lesson (GST) receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Wallet Lesson (GST)', status: 'FAILED', error: error.message });
}

// Test 3: Wallet Lesson (non-GST)
console.log('3. Testing Wallet Lesson Receipt (non-GST provider)...');
try {
  const nonGstProvider = { ...provider, gstRegistered: false };
  const context = createWalletLessonContext({
    transactionId: 'test_wallet_003',
    customer,
    provider: nonGstProvider,
    booking,
    lessonCost: 90,
    walletPreviousBalance: 554.22,
    walletNewBalance: 464.22,
    providerHourlyRate: 90
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/03-wallet-lesson-nongst.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Wallet Lesson (non-GST)', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Wallet Lesson (non-GST)', status: 'HTML', file: '03-wallet-lesson-nongst.html' });
  }
  console.log('   ✓ Wallet Lesson (non-GST) receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Wallet Lesson (non-GST)', status: 'FAILED', error: error.message });
}

// Test 4: Single Lesson
console.log('4. Testing Single Lesson Receipt...');
try {
  const context = createSingleLessonContext({
    transactionId: 'test_single_004',
    customer,
    provider,
    booking,
    payment: { total: 93.24, method: 'Mastercard ending in 5555', stripePaymentIntentId: 'pi_test_single' },
    lessonCost: 90
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/04-single-lesson.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Single Lesson', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Single Lesson', status: 'HTML', file: '04-single-lesson.html' });
  }
  console.log('   ✓ Single Lesson receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Single Lesson', status: 'FAILED', error: error.message });
}

// Test 5: Wallet Top-Up
console.log('5. Testing Wallet Top-Up Receipt...');
try {
  const context = createWalletTopUpContext({
    transactionId: 'test_topup_005',
    customer,
    payment: { total: 500, method: 'Visa ending in 4242', stripePaymentIntentId: 'pi_test_topup' },
    topUpAmount: 500,
    walletPreviousBalance: 464.22,
    walletNewBalance: 964.22
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/05-wallet-topup.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Wallet Top-Up', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Wallet Top-Up', status: 'HTML', file: '05-wallet-topup.html' });
  }
  console.log('   ✓ Wallet Top-Up receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Wallet Top-Up', status: 'FAILED', error: error.message });
}

// Test 6: Cancellation
console.log('6. Testing Cancellation Receipt...');
try {
  const context = createCancellationContext({
    transactionId: 'test_cancel_006',
    customer,
    provider,
    booking,
    cancelledBy: 'student',
    refundAmount: 90,
    refundPercent: 100,
    refundDestination: 'card'
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/06-cancellation.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Cancellation', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Cancellation', status: 'HTML', file: '06-cancellation.html' });
  }
  console.log('   ✓ Cancellation receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Cancellation', status: 'FAILED', error: error.message });
}

// Test 7: Admin Credit
console.log('7. Testing Admin Credit Receipt...');
try {
  const context = createAdminCreditContext({
    transactionId: 'test_credit_007',
    customer,
    creditAmount: 50,
    creditReason: 'Service recovery compensation',
    walletPreviousBalance: 964.22,
    walletNewBalance: 1014.22
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/07-admin-credit.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Admin Credit', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Admin Credit', status: 'HTML', file: '07-admin-credit.html' });
  }
  console.log('   ✓ Admin Credit receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Admin Credit', status: 'FAILED', error: error.message });
}

// Test 8: Admin Deduction
console.log('8. Testing Admin Deduction Receipt...');
try {
  const context = createAdminDeductionContext({
    transactionId: 'test_deduct_008',
    customer,
    deductionAmount: 20,
    deductionReason: 'Policy violation adjustment',
    walletPreviousBalance: 1014.22,
    walletNewBalance: 994.22
  });
  
  const html = receiptService.generateHTML(context);
  writeFileSync('test-output/08-admin-deduction.html', html);
  
  if (SEND_EMAILS) {
    await receiptService.generateAndSend(context);
    results.push({ scenario: 'Admin Deduction', status: 'SENT', email: TEST_EMAIL });
  } else {
    results.push({ scenario: 'Admin Deduction', status: 'HTML', file: '08-admin-deduction.html' });
  }
  console.log('   ✓ Admin Deduction receipt generated');
} catch (error) {
  console.log('   ✗ Error:', error.message);
  results.push({ scenario: 'Admin Deduction', status: 'FAILED', error: error.message });
}

// Summary
console.log('\n=== TEST RESULTS ===\n');
console.table(results);

const successful = results.filter(r => r.status !== 'FAILED').length;
console.log(`\nTotal: ${results.length} | Success: ${successful} | Failed: ${results.length - successful}`);

if (SEND_EMAILS) {
  console.log(`\nCheck your inbox at ${TEST_EMAIL}`);
  console.log(`Or check your local SMTP server UI`);
} else {
  console.log(`\nHTML files saved to: test-output/`);
  console.log(`Open in browser to inspect receipts`);
  console.log(`\nTo enable email sending:`);
  console.log(`  set TEST_SEND_EMAILS=true && npx tsx local-receipt-test.mjs`);
}
