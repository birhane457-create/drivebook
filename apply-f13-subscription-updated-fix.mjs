#!/usr/bin/env node
/**
 * F-13: Fix subscription.updated handler
 * Replace trial row matching with atomic conditional update
 */

import { readFileSync, writeFileSync } from 'fs';

const file = 'app/api/stripe/webhook/route.ts';
console.log('F-13: Fixing subscription.updated handler...\n');

let content = readFileSync(file, 'utf8');

// Find the subscription.updated handler trial row matching
const oldPattern = /\/\/ Look for an existing trial subscription record without a stripeSubscriptionId\s+const trialRow = await tx\.subscription\.findFirst\(\{[\s\S]*?\}\);[\s\S]*?if \(trialRow\) \{[\s\S]*?\}\);[\s\S]*?\} else \{[\s\S]*?currentPeriodEnd: new Date\(current_period_end \* 1000\),[\s\S]*?\}\);[\s\S]*?\}\s+\}/;

const newCode = `// F-13 FIX: Atomic conditional update using stripeCustomerId correlation
          const claimResult = await tx.subscription.updateMany({
            where: {
              providerId,
              stripeCustomerId: subscription.customer as string,  // F-13: Authoritative correlation
              stripeSubscriptionId: null,                         // F-13: Atomic claim condition
              status: { in: ['TRIAL', 'ACTIVE'] },
            },
            data: {
              tier: tier as any,
              status: normalizeStatus(status) as any,
              monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
              billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
              currentPeriodEnd: new Date(current_period_end * 1000),
              stripeSubscriptionId: subscription.id,         // Atomic claim
              stripeCustomerId: subscription.customer as string,
            }
          });
    
          if (claimResult.count === 0) {
            // No trial row claimed - check if already linked
            const existing = await tx.subscription.findFirst({
              where: { stripeSubscriptionId: subscription.id }
            });
    
            if (existing) {
              // Already linked - update it (idempotent)
              logger.info(\`Subscription \${subscription.id} already linked - updating existing row\`);
              await tx.subscription.update({
                where: { id: existing.id },
                data: {
                  tier: tier as any,
                  status: normalizeStatus(status) as any,
                  monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
                  billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
                  currentPeriodEnd: new Date(current_period_end * 1000),
                  stripeCustomerId: subscription.customer as string,
                }
              });
            } else {
              // No trial exists - create new subscription row
              logger.info(\`No trial found for \${subscription.id} - creating new subscription\`);
              const current_period_start = (subscription as any).current_period_start;
              await tx.subscription.create({
                data: {
                  providerId,
                  tier: tier as any,
                  status: normalizeStatus(status) as any,
                  monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
                  billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
                  currentPeriodStart: new Date(current_period_start * 1000),
                  currentPeriodEnd: new Date(current_period_end * 1000),
                  stripeCustomerId: subscription.customer as string,
                  stripeSubscriptionId: subscription.id,
                }
              });
            }
          } else {
            logger.info(\`✓ Successfully claimed trial row for subscription \${subscription.id} (count: \${claimResult.count})\`);
          }
        }`;

if (content.match(oldPattern)) {
  content = content.replace(oldPattern, newCode);
  writeFileSync(file, content, 'utf8');
  console.log('✓ Fixed subscription.updated handler');
} else {
  console.log('⚠️  Pattern not found - checking alternative pattern...');
  
  // Try a simpler pattern match
  const simplePattern = /const trialRow = await tx\.subscription\.findFirst\(\{\s+where: \{\s+providerId,\s+stripeSubscriptionId: null,\s+status: \{ in: \['TRIAL', 'ACTIVE'\] \},\s+\},\s+orderBy: \{ createdAt: 'desc' \},\s+\}\);/g;
  
  const matches = content.match(simplePattern);
  if (matches) {
    console.log(\`Found \${matches.length} trial row queries to fix\`);
  } else {
    console.log('Could not find pattern - will need manual inspection');
  }
}

console.log('\nDone!');
