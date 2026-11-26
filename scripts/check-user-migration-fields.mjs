/**
 * Check terms acceptance and email verification fields on both databases.
 *
 * Compares Tokyo (Japan) vs Sydney (production) User records to identify
 * which users lost termsAcceptedAt, termsVersion, emailVerified, emailVerifiedAt
 * during the migration.
 *
 * Usage:
 *   DATABASE_URL="postgresql://tokyo..." node scripts/check-user-migration-fields.mjs tokyo
 *   DATABASE_URL="postgresql://sydney..." node scripts/check-user-migration-fields.mjs sydney
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const source = process.argv[2] || 'unknown';

async function main() {
  const url = process.env.DATABASE_URL || '';
  console.log(`\n=== ${source.toUpperCase()} ===`);
  console.log('Target:', url.replace(/:([^:@]+)@/, ':***@'));

  const total = await prisma.user.count();
  console.log('Total users:', total);

  // Users with terms accepted
  const termsAccepted = await prisma.user.count({
    where: { termsAcceptedAt: { not: null } },
  });
  console.log('termsAcceptedAt NOT NULL:', termsAccepted);

  // Users with terms version
  const hasTermsVersion = await prisma.user.count({
    where: { termsVersion: { not: null } },
  });
  console.log('termsVersion NOT NULL:', hasTermsVersion);

  // Users with emailVerified = true
  const emailVerified = await prisma.user.count({
    where: { emailVerified: true },
  });
  console.log('emailVerified = true:', emailVerified);

  // Users with emailVerifiedAt
  const hasEmailVerifiedAt = await prisma.user.count({
    where: { emailVerifiedAt: { not: null } },
  });
  console.log('emailVerifiedAt NOT NULL:', hasEmailVerifiedAt);

  // Sample: show first 10 users with their field values
  const sample = await prisma.user.findMany({
    take: 10,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      termsAcceptedAt: true,
      termsVersion: true,
      emailVerified: true,
      emailVerifiedAt: true,
    },
  });

  console.log('\nSample (first 10 users):');
  for (const u of sample) {
    console.log(
      `  ${u.email}: terms=${u.termsAcceptedAt ? 'Y' : 'N'} v=${u.termsVersion ?? 'null'} ` +
      `emailVerified=${u.emailVerified ? 'Y' : 'N'} at=${u.emailVerifiedAt ?? 'null'}`
    );
  }
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
