# SUB-22 Webhook Handler Fix - Implementation Patch

**File:** `app/api/stripe/webhook/route.ts`  
**Function:** `handleSubscriptionUpdate()`  
**Lines:** ~1481-1545  

---

## Changes Required

Replace the trial-row claiming logic (findFirst → update pattern) with atomic conditional update.

### Location

After the Provider update block (line ~1480), replace the entire "Update or create subscription record" section.

### OLD CODE (REMOVE)

```typescript
        // Update or create subscription record
        // Priority: find by stripeSubscriptionId first (renewal/update).
        // If not found, find the most-recent non-stripe trial row for this instructor
        // (race condition: customer.subscription.created fires before checkout.session.completed
        // stamps the stripeSubscriptionId — so we link it rather than create a duplicate).
        const existingSubscription = await tx.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id }
        });
    
        if (existingSubscription) {
          await tx.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              tier: tier as any,
              status: normalizeStatus(status) as any,
              monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
              billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
              currentPeriodEnd: new Date(current_period_end * 1000),
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
            }
          });
        } else {
          // Look for an existing trial subscription record without a stripeSubscriptionId
          const trialRow = await tx.subscription.findFirst({
            where: {
              providerId,
              stripeSubscriptionId: null,
              status: { in: ['TRIAL', 'ACTIVE'] },
            },
            orderBy: { createdAt: 'desc' },
          });
    
          if (trialRow) {
            // Link the Stripe subscription to the existing trial row — prevents duplicate rows
            logger.info(`🔗 Linking Stripe subscription ${subscription.id} to existing trial row ${trialRow.id} for instructor ${providerId}`);
            await tx.subscription.update({
              where: { id: trialRow.id },
              data: {
                tier: tier as any,
                status: normalizeStatus(status) as any,
                monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
                billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
                currentPeriodEnd: new Date(current_period_end * 1000),
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
              }
            });
          } else {
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
        }
```

### NEW CODE (INSERT)

```typescript
        // Update or create subscription record
        // SUB-22 FIX: Use atomic conditional update to prevent race conditions
        // Priority: find by stripeSubscriptionId first (renewal/update).
        // If not found, atomically claim an unclaimed trial row for this provider.
        const existingSubscription = await tx.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id }
        });
    
        if (existingSubscription) {
          // Stripe subscription already linked - update it (idempotent)
          await tx.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              tier: tier as any,
              status: normalizeStatus(status) as any,
              monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
              billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
              currentPeriodEnd: new Date(current_period_end * 1000),
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
            }
          });
        } else {
          // Atomic trial claim: updateMany returns affected row count
          // This prevents race conditions where two events both try to claim the same trial
          const claimResult = await tx.subscription.updateMany({
            where: {
              providerId,
              stripeSubscriptionId: null,
              status: { in: ['TRIAL', 'ACTIVE'] },
            },
            data: {
              tier: tier as any,
              status: normalizeStatus(status) as any,
              monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
              billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
              currentPeriodEnd: new Date(current_period_end * 1000),
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
            }
          });
    
          if (claimResult.count === 1) {
            // Successfully claimed trial subscription
            logger.info(`✅ SUB-22: Claimed trial subscription for provider ${providerId}, Stripe subscription ${subscription.id}`);
            
          } else if (claimResult.count === 0) {
            // Trial already claimed or doesn't exist - verify which case
            const currentSub = await tx.subscription.findFirst({
              where: {
                providerId,
                status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] },
              }
            });
    
            if (currentSub) {
              if (currentSub.stripeSubscriptionId === subscription.id) {
                // Idempotent: This Stripe subscription already linked (concurrent event)
                logger.info(`♻️  SUB-22: Subscription ${subscription.id} already linked for provider ${providerId} (idempotent replay)`);
                
                // Update non-key fields to ensure latest data
                await tx.subscription.update({
                  where: { id: currentSub.id },
                  data: {
                    tier: tier as any,
                    status: normalizeStatus(status) as any,
                    monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
                    billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
                    currentPeriodEnd: new Date(current_period_end * 1000),
                  }
                });
                
              } else {
                // CONFLICT: Provider has different Stripe subscription
                // Do NOT silently override - this requires investigation
                logger.error(`❌ SUB-22 CONFLICT: Provider ${providerId} subscription mismatch:
                  Existing Stripe subscription: ${currentSub.stripeSubscriptionId}
                  Incoming Stripe subscription: ${subscription.id}
                  Status: ${currentSub.status}
                  This indicates either:
                  1. Duplicate billing (Stripe has two active subscriptions)
                  2. Webhook replay after cancellation/replacement
                  3. Data integrity issue
                  Manual investigation required - NOT automatically overriding.`);
                
                throw new Error(`SUB-22: Stripe subscription conflict for provider ${providerId}: existing ${currentSub.stripeSubscriptionId}, incoming ${subscription.id}`);
              }
            } else {
              // No current subscription exists - create new (legitimate case)
              logger.info(`➕ SUB-22: Creating new subscription for provider ${providerId}, Stripe subscription ${subscription.id}`);
              
              const current_period_start = (subscription as any).current_period_start;
              try {
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
              } catch (createError: any) {
                // Handle unique constraint violation (expected under high concurrency)
                if (createError.code === 'P2002') {
                  const target = createError.meta?.target || [];
                  if (target.includes('providerId') || target.includes('provider_current_unique')) {
                    logger.info(`🔒 SUB-22: Concurrent subscription creation blocked by unique constraint for provider ${providerId} - another event won the race`);
                    // Re-read and accept the winner's subscription
                    const winnerSub = await tx.subscription.findFirst({
                      where: { providerId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } }
                    });
                    if (winnerSub && winnerSub.stripeSubscriptionId === subscription.id) {
                      logger.info(`✅ SUB-22: Winner subscription matches this event (${subscription.id}) - consistent state`);
                    } else {
                      logger.warn(`⚠️  SUB-22: Winner subscription (${winnerSub?.stripeSubscriptionId}) differs from this event (${subscription.id})`);
                    }
                  } else if (target.includes('stripeSubscriptionId')) {
                    logger.error(`❌ SUB-22: Duplicate Stripe subscription ID ${subscription.id} - data integrity issue`);
                    throw new Error(`Duplicate Stripe subscription ID: ${subscription.id}`);
                  } else {
                    throw createError; // Unexpected constraint
                  }
                } else {
                  throw createError; // Not a constraint error
                }
              }
            }
            
          } else {
            // count > 1: Multiple trials claimed (shouldn't happen with partial unique index)
            logger.error(`❌ SUB-22: Unexpected - ${claimResult.count} trial rows claimed for provider ${providerId}`);
            throw new Error(`SUB-22: Multiple trials claimed for provider ${providerId} - data integrity issue`);
          }
        }
```

---

## Key Changes

1. **Atomic Claim**: Use `updateMany()` instead of `findFirst() → update()`
2. **Affected Row Check**: Verify `claimResult.count` to detect concurrent claims
3. **Idempotent Replay**: Detect when same Stripe subscription already linked
4. **Conflict Detection**: Flag different Stripe subscription IDs as errors (no silent override)
5. **Constraint Handling**: Explicit P2002 error handling for unique constraint violations
6. **Comprehensive Logging**: All outcomes logged with SUB-22 prefix

---

## Manual Application Instructions

Due to special characters in the original file, apply this patch manually:

1. Open `app/api/stripe/webhook/route.ts`
2. Locate `handleSubscriptionUpdate()` function (~line 1393)
3. Find the comment "Update or create subscription record" (~line 1481)
4. Delete from that comment through the closing `}` of the else block (~line 1545)
5. Insert the NEW CODE from this patch
6. Save file
7. Run TypeScript compilation to verify: `npm run build` or `tsc --noEmit`

---

## Testing

After applying:
1. Run `npm run build` - must succeed
2. Run Step 3 test suite: `npm test -- app/api/stripe/webhook/__tests__/sub-22-concurrent.test.ts`
3. Verify no duplicate subscriptions can be created
4. Verify Stripe ID conflicts are logged and blocked

---

## Status

- [ ] Patch applied
- [ ] Build succeeds
- [ ] Tests updated
- [ ] Tests pass
- [ ] Verified in development
