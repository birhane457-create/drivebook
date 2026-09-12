import { receiptService, createPackagePurchaseContext, createSingleLessonContext, createCancellationContext, DocumentType } from './lib/services/receipt/index';
import { writeFileSync } from 'fs';

const mockCustomer = { name: 'John Smith', email: 'john@test.com' };
const mockProvider = { id: 'p1', name: 'Jane Instructor', abn: '12345678901', abnVerified: true, gstRegistered: true };
const mockBooking = { id: 'b1', startTime: new Date('2024-06-15T10:00:00+10:00'), duration: 60, pickupAddress: '123 Test St' };

// 1. Package Purchase
const pkg = createPackagePurchaseContext({
  transactionId: 'pkg001',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  payment: { total: 885.78, method: 'Visa 4242' },
  discountedPackageValue: 855,
  firstLessonCost: 90,
  walletCredited: 734.22,
  walletPreviousBalance: 0,
  walletNewBalance: 644.22,
  providerHourlyRate: 90
});
const pkgHtml = receiptService.generateHTML(pkg);
writeFileSync('test-package.html', pkgHtml);
console.log('Package receipt: test-package.html');

// 2. Single Lesson  
const single = createSingleLessonContext({
  transactionId: 'single001',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  payment: { total: 93.24, method: 'Visa 4242' },
  lessonCost: 90
});
const singleHtml = receiptService.generateHTML(single);
writeFileSync('test-single.html', singleHtml);
console.log('Single lesson receipt: test-single.html');

// 3. Cancellation
const cancel = createCancellationContext({
  transactionId: 'cancel001',
  customer: mockCustomer,
  provider: mockProvider,
  booking: mockBooking,
  cancelledBy: 'student',
  refundAmount: 90,
  refundPercent: 100,
  refundDestination: 'card'
});
const cancelHtml = receiptService.generateHTML(cancel);
writeFileSync('test-cancellation.html', cancelHtml);
console.log('Cancellation receipt: test-cancellation.html');

console.log('\nHTML files generated. Checking content...');
console.log(`Package HTML size: ${pkgHtml.length} bytes`);
console.log(`Single HTML size: ${singleHtml.length} bytes`);
console.log(`Cancel HTML size: ${cancelHtml.length} bytes`);
