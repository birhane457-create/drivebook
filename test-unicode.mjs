import { createSingleLessonContext, receiptService } from './lib/services/receipt/index';

const context = createSingleLessonContext({
  transactionId: 'unicode_test',
  customer: { name: 'Test', email: 'test@test.com' },
  provider: { id: 'p1', name: 'Provider', abn: '12345678901', abnVerified: true, gstRegistered: true },
  booking: { id: 'b1', startTime: new Date(), duration: 60, pickupAddress: '123 St' },
  payment: { total: 93.24 },
  lessonCost: 90
});

const html = receiptService.generateHTML(context);

// Check for multiplication sign
const hasMultiply = html.includes('×');
const hasHtmlEntity = html.includes('&times;');
const hasUnicode00D7 = html.includes('\u00D7');

console.log('HTML Character Checks:');
console.log('Contains × (Unicode): ', hasMultiply);
console.log('Contains &times; (HTML entity): ', hasHtmlEntity);
console.log('Contains \\u00D7: ', hasUnicode00D7);

// Extract a sample with the character
const match = html.match(/Driving Lesson[^<]{0,50}/);
if (match) {
  console.log('\nExtracted text:', match[0]);
  console.log('Character codes:', Array.from(match[0]).map((c, i) => `${i}: ${c} (${c.charCodeAt(0)})`).join('\n'));
}
