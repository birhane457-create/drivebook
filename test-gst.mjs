// Test GST calculation for $31.95
const amount = 31.95;
const gst_divisor = 1.1;
const gst_raw = amount - (amount / gst_divisor);
const gst_rounded = Math.round(gst_raw * 100) / 100;

console.log('Amount: $31.95');
console.log('GST (raw):', gst_raw);
console.log('GST (rounded):', gst_rounded);
console.log('Test expects: 2.91');
console.log('Match:', gst_rounded === 2.91);

// Verify the calculation step-by-step
console.log('\nStep-by-step:');
console.log('31.95 / 1.1 =', amount / gst_divisor);
console.log('31.95 - 29.045454... =', gst_raw);
console.log('2.904545... * 100 =', gst_raw * 100);
console.log('Math.round(290.4545...) =', Math.round(gst_raw * 100));
console.log('290 / 100 =', Math.round(gst_raw * 100) / 100);
