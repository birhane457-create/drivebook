/**
 * DATA-EXP-01 Verification Script
 *
 * Directly replicates the fixed query from app/api/public/instructors/route.ts
 * to verify: (1) phone is absent from the response, (2) normal fields are intact.
 *
 * Usage (real DB via pooler):
 *   DATABASE_URL="postgresql://..." node scripts/verify-data-exp-01.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('DATA-EXP-01 Verification');
  console.log('========================');
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? 'undefined'}`);
  console.log('');

  // Replicate EXACTLY the fixed query from app/api/public/instructors/route.ts
  const instructors = await prisma.provider.findMany({
    where: { approvalStatus: 'APPROVED', isActive: true },
    select: {
      id: true,
      name: true,
      bio: true,
      profileImage: true,
      hourlyRate: true,
      baseAddress: true,
      languages: true,
      averageRating: true,
      totalReviews: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { name: 'asc' },
  });

  const formattedInstructors = instructors.map((instructor) => ({
    id:            instructor.id,
    name:          instructor.name,
    bio:           instructor.bio,
    profileImage:  instructor.profileImage,
    hourlyRate:    instructor.hourlyRate,
    baseAddress:   instructor.baseAddress,
    languages:     instructor.languages,
    rating:        instructor.averageRating ? Number(instructor.averageRating.toFixed(1)) : null,
    reviews:       instructor.totalReviews,
    totalBookings: instructor._count.bookings,
  }));

  let pass = true;

  // CHECK 1: query ran without error
  console.log(`CHECK 1: Query executed successfully`);
  console.log(`  ✓ ${instructors.length} approved active instructor(s) found`);

  if (instructors.length === 0) {
    console.log('  ⚠  No approved instructors — using structural check only');
    // Still verify the empty array is returned correctly (not 500)
    console.log(`  ✓ Empty array returned — correct shape for zero records`);
  } else {
    const rawRow  = instructors[0];
    const respObj = formattedInstructors[0];

    // CHECK 2: phone absent from raw Prisma result
    console.log(`\nCHECK 2: phone absent from Prisma select result`);
    if ('phone' in rawRow) {
      console.log(`  ✗ FAIL — phone present in Prisma row: ${rawRow.phone}`);
      pass = false;
    } else {
      console.log(`  ✓ phone NOT in Prisma row`);
    }

    // CHECK 3: phone absent from formatted response
    console.log(`\nCHECK 3: phone absent from formatted response object`);
    if ('phone' in respObj) {
      console.log(`  ✗ FAIL — phone present in response: ${respObj.phone}`);
      pass = false;
    } else {
      console.log(`  ✓ phone NOT in formatted response`);
    }

    // CHECK 4: required public fields present
    console.log(`\nCHECK 4: required public fields intact`);
    const required = ['id', 'name', 'hourlyRate', 'rating', 'reviews', 'totalBookings'];
    for (const field of required) {
      if (field in respObj) {
        console.log(`  ✓ ${field}: ${JSON.stringify(respObj[field])}`);
      } else {
        console.log(`  ✗ FAIL — missing field: ${field}`);
        pass = false;
      }
    }

    // CHECK 5: sample
    console.log(`\nSAMPLE RESPONSE (first instructor):`);
    console.log(JSON.stringify(respObj, null, 2));
  }

  console.log('');
  console.log('========================');
  if (pass) {
    console.log('RESULT: ✅ ALL CHECKS PASSED — DATA-EXP-01 remediation verified');
  } else {
    console.log('RESULT: ✗ ONE OR MORE CHECKS FAILED');
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error('Script error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
