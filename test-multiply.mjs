import { classifyLineItem } from './lib/services/receipt/builder';
import { LineItemType, SupplierType } from './lib/services/receipt/types';

const provider = { id: 'p1', name: 'Test', abn: '12345678901', abnVerified: true, gstRegistered: true };

const item = {
  description: 'Driving Lesson',
  type: 'SERVICE',
  amount: 90,
  quantity: 1.5,
  rate: 60,
  supplier: 'PROVIDER',
  taxable: false
};

const enriched = classifyLineItem(item, provider);

console.log('Formatted Description:', enriched.formattedDescription);
console.log('Expected: Driving Lesson (1.5 × $60.00)');
console.log('Match:', enriched.formattedDescription === 'Driving Lesson (1.5 × $60.00)');

// Check character codes
const desc = enriched.formattedDescription;
console.log('\nCharacter analysis:');
for (let i = 0; i < desc.length; i++) {
  const char = desc[i];
  const code = char.charCodeAt(0);
  if (code > 127 || char === '×' || char === '(' || char === ')') {
    console.log(`Position ${i}: "${char}" = U+${code.toString(16).toUpperCase().padStart(4, '0')} (${code})`);
  }
}
