#!/usr/bin/env node
/**
 * Move audit log calls outside transactions
 * Target: 3 logSubscriptionAction calls that are currently inside transactions
 */

import { readFileSync, writeFileSync } from 'fs';

const file = 'app/api/stripe/webhook/route.ts';
let content = readFileSync(file, 'utf8');

console.log('Moving audit log calls outside transactions...\n');

// Pattern 1: checkout.session.completed (subscription) - around line 632
// Remove audit log from transaction and add after
const pattern1 = /(\s+\/\/ Audit log\s+await logSubscriptionAction\(\{[^}]+\}\);)\s+(\}\), SERIALIZABLE_TX\);\s+\}\), \{ operationName: 'webhook-checkout-session-subscription' \}\);)/s;

if (content.match(pattern1)) {
  content = content.replace(pattern1, (match, auditCall, closingBraces) => {
    // Extract audit details to use after transaction
    return `${closingBraces}

  // Audit log (outside transaction - non-fatal, best-effort)
  try {
    const tier = metadata?.tier;
    await logSubscriptionAction({
      subscriptionId: checkoutSession.id,
      providerId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      metadata: {
        event: 'checkout_completed',
        customerId: customer,
        tier: tier ?? 'unknown',
        stripeSubscriptionId: checkoutSession.subscription ?? null,
      }
    });
  } catch (auditErr) {
    logger.error('Failed to log audit event (non-fatal)', { error: auditErr });
  }`;
  });
  console.log('✓ Moved audit log #1: checkout.session.completed');
} else {
  console.log('⚠️  Pattern #1 not found');
}

// Pattern 2 & 3: More complex, need different approach
// Let's do a simple search and manual template

writeFileSync(file, content, 'utf8');
console.log('\nPhase 1 complete. Manual adjustment may be needed for patterns 2 & 3.');
console.log('Locations: subscription.updated (~line 1514) and subscription.cancelled (~line 1588)');
