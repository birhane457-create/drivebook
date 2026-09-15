// Verify multiple GST calculations
const tests = [
  { amount: 110.00, expected_test: 10.00 },
  { amount: 100.00, expected_test: 9.09 },
  { amount: 31.95, expected_test: 2.91 },
  { amount: 885.78, expected_test: 80.53 }
];

console.log('GST Calculation Verification:\n');
tests.forEach(t => {
  const gst_raw = t.amount - (t.amount / 1.1);
  const gst_rounded = Math.round(gst_raw * 100) / 100;
  const match = gst_rounded === t.expected_test;
  console.log(`$${t.amount.toFixed(2)}:`);
  console.log(`  Raw GST: $${gst_raw.toFixed(10)}`);
  console.log(`  Rounded: $${gst_rounded.toFixed(2)}`);
  console.log(`  Test expects: $${t.expected_test.toFixed(2)}`);
  console.log(`  ${match ? '✓ PASS' : '✗ FAIL'}\n`);
});
