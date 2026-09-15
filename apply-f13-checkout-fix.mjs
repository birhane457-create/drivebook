#!/usr/bin/env node
/**
 * F-13: Fix checkout.session.completed handler
 * Replace trial row matching with atomic conditional update
 */

import { readFileSync, writeFileSync } from 'fs';

const file = 'app/api/stripe/webhook/route.ts';
console.log('F-13: Fixing checkout.session.completed handler...\n');

let content = readFileSync(file, 'utf8');

// Find and replace the trial row matching logic
const oldPattern = /\/\/ Find the trial row without a stripeSubscriptionId first \(race condition safe\)\s+const trialRow = await tx\.subscription\.findFirst\(\{[\s\S]*?\}\);[\s\S]*?if \(trialRow\) \{[\s\S]*?\} else \{[\s\S]*?\}\s+\} else \{/;

const newCode = `// F-13 FIX: Atomic conditional update using stripeCustomerId correlation
          // This prevents race condition where multiple webhooks try to claim the same trial row
          const claimResult = await tx.subscription.updateMany({
            where: {
              providerId,
              stripeCustomerId: customer as string,  // F-13: Authoritative correlation
              stripeSubscriptionId: null,            // F-13: Atomic claim condition
              // status filter as additional safety, but stripeSubscriptionId IS NULL is the key invariant
              status: { in: ['TRIAL', 'ACTIVE'] },
            },
            data: {
              tier: tier as any,
              status: 'ACTIVE',
              stripeCustomerId: customer as string,  // Ensure it's set (idempotent)
              stripeSubscriptionId: stripeSubId,     // Atomic claim
            },
          });
    
          if (claimResult.count === 0) {
            // No trial row claimed - check if already linked by another webhook
            const existingSubscription = await tx.subscription.findFirst({
              where: { stripeSubscriptionId: stripeSubId }
            });
    
            if (existingSubscription) {
              // Already linked by concurrent webhook - update it (idempotent)
              logger.info(\`Subscription \${stripeSubId} already linked by another webhook - updating existing row\`);
              await tx.subscription.update({
                where: { id: existingSubscription.id },
                data: {
                  tier: tier as any,
                  status: 'ACTIVE',
                  stripeCustomerId: customer as string,
                },
              });
            } else {
              // No trial row exists and not yet linked - use broad update as fallback
              // This handles legacy data or edge cases
              logger.warn(\`No trial row found for providerId=\${providerId} customerId=\${customer} - using fallback\`);
              await tx.subscription.updateMany({
                where: { providerId },
                data: {
                  tier: tier as any,
                  status: 'ACTIVE',
                  stripeCustomerId: customer as string,
                  stripeSubscriptionId: stripeSubId,
                },
              });
            }
          } else {
            logger.info(\`✓ Successfully claimed trial row for subscription \${stripeSubId} (count: \${claimResult.count})\`);
          }
        } else {`;

if (content.match(oldPattern)) {
  content = content.replace(oldPattern, newCode);
  writeFileSync(file, content, 'utf8');
  console.log('✓ Fixed checkout.session.completed handler');
} else {
  console.log('⚠️  Pattern not found - manual edit required');
}

console.log('\nDone!');
