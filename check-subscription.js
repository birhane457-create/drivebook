const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const instructor = await p.instructor.findFirst({
    where: { customDomain: 'sssssss' },
    select: {
      id: true,
      name: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
    },
  });

  console.log('\nInstructor subscription fields:');
  console.log(JSON.stringify(instructor, null, 2));

  const subs = await p.subscription.findMany({
    where: { instructorId: instructor.id },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\nSubscription records (' + subs.length + '):');
  console.log(JSON.stringify(subs, null, 2));
}

check().catch(console.error).finally(() => p.$disconnect());
