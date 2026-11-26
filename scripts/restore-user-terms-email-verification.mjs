/**
 * Restore termsAcceptedAt, termsVersion, emailVerified, and emailVerifiedAt
 * for all existing production users — WITHOUT triggering onboarding emails.
 *
 * These fields were lost during the Tokyo -> Sydney database migration.
 *
 * What this script does:
 *   1. Sets termsAcceptedAt = createdAt, termsVersion = '1.0',
 *      emailVerified = true, emailVerifiedAt = createdAt for all users
 *      where these fields are currently null/false.
 *   2. Pre-seeds ONBOARDING_EMAIL_SENT audit log entries for all PENDING
 *      providers so the onboarding cron's deduplication check (hasBeenSent)
 *      sees every onboarding step as already sent.  No welcome or onboarding
 *      emails will be sent to these users.
 *
 * The script does NOT:
 *   - Call any API route (no HTTP, no Next.js)
 *   - Send any emails or SMS
 *   - Trigger any webhook or cron
 *   - Change approvalStatus or any business state
 *
 * Usage:
 *   DATABASE_URL="postgresql://sydney..." node scripts/restore-user-terms-email-verification.mjs --allow-production
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL || '';
const allowProduction = process.argv.includes('--allow-production');

if (url.includes('jflrqxigfiiqednfacuf') && !allowProduction) {
  console.error('ERROR: DATABASE_URL points at Sydney production — pass --allow-production to confirm');
  process.exit(1);
}
if (url.includes('jflrqxigfiiqednfacuf') && allowProduction) {
  console.warn('WARNING: Running against SYDNEY PRODUCTION database');
}

// All onboarding steps that the cron checks via hasBeenSent()
const ONBOARDING_STEPS = [
  { id: 'onboarding.welcome',         version: 1 }, // registration step
  { id: 'onboarding.setup',           version: 2 }, // cron step 2
  { id: 'onboarding.bookings',        version: 1 }, // cron step 3
  { id: 'onboarding.profile-tips',    version: 1 }, // cron step 4
  { id: 'onboarding.ai-receptionist', version: 1 }, // cron step 5
];

async function main() {
  console.log('Target:', url.replace(/:([^:@]+)@/, ':***@'));

  // ── Step 1: Restore terms + email verification fields ────────────────────
  const needsRestore = await prisma.user.findMany({
    where: {
      AND: [
        { termsAcceptedAt: null },
        { emailVerified: false },
      ],
    },
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nUsers needing field restoration: ${needsRestore.length}`);

  if (needsRestore.length === 0) {
    console.log('No users need restoration — all fields already set.');
  } else {
    for (const u of needsRestore) {
      console.log(`  ${u.email} | role=${u.role} | created=${u.createdAt.toISOString().slice(0, 10)}`);
    }

    if (!allowProduction) {
      console.log('\n(Dry run — pass --allow-production to apply changes)');
      return;
    }

    console.log('\nRestoring fields...');
    let updated = 0;
    for (const u of needsRestore) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          termsAcceptedAt: u.createdAt,
          termsVersion: '1.0',
          emailVerified: true,
          emailVerifiedAt: u.createdAt,
        },
      });
      updated++;
      console.log(`  OK ${u.email}`);
    }
    console.log(`${updated} users restored.`);
  }

  // ── Step 2: Pre-seed onboarding audit log for PENDING providers ──────────
  // This prevents the onboarding cron from sending welcome/setup/bookings/
  // profile-tips/ai emails to these providers when it next runs.
  const pendingProviders = await prisma.provider.findMany({
    where: { approvalStatus: 'PENDING' },
    select: { id: true, name: true, user: { select: { email: true } } },
  });

  console.log(`\nPENDING providers needing onboarding suppression: ${pendingProviders.length}`);

  if (pendingProviders.length === 0) {
    console.log('No PENDING providers — nothing to suppress.');
  } else if (!allowProduction) {
    for (const p of pendingProviders) {
      console.log(`  Would suppress: ${p.user.email} (${p.name})`);
    }
    console.log('\n(Dry run — pass --allow-production to apply changes)');
    return;
  } else {
    let suppressed = 0;
    for (const provider of pendingProviders) {
      for (const step of ONBOARDING_STEPS) {
        // Check if already seeded (idempotent)
        const existing = await prisma.auditLog.findFirst({
          where: {
            action: 'ONBOARDING_EMAIL_SENT',
            targetType: 'provider',
            targetId: provider.id,
            metadata: { path: ['emailId'], equals: step.id },
          },
        });

        if (existing) {
          continue; // already seeded
        }

        // Seed the audit entry — marks this onboarding step as "already sent"
        await prisma.auditLog.create({
          data: {
            action: 'ONBOARDING_EMAIL_SENT',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'provider',
            targetId: provider.id,
            success: true,
            metadata: {
              emailId: step.id,
              version: step.version,
              sentAt: new Date().toISOString(),
              skipped: true,
              reason: 'migrated_from_tokyo_pre_seed',
            },
          },
        });
        suppressed++;
      }
      console.log(`  Suppressed onboarding for: ${provider.user.email} (${provider.name})`);
    }
    console.log(`${suppressed} onboarding audit entries seeded (no emails will be sent).`);
  }

  // ── Verify ───────────────────────────────────────────────────────────────
  const verified = await prisma.user.count({
    where: {
      AND: [
        { termsAcceptedAt: { not: null } },
        { emailVerified: true },
      ],
    },
  });
  console.log(`\nVerification: ${verified} users now have termsAcceptedAt AND emailVerified.`);
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
