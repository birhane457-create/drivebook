const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMaylandsCoordinates() {
  console.log('Fixing Maylands coordinates for all instructors...\n');

  // Maylands, WA 6051 correct coordinates
  const maylandsLat = -31.9365658;
  const maylandsLng = 115.8797607;

  const instructors = await prisma.instructor.findMany({
    where: {
      OR: [
        { baseAddress: { contains: 'Maylamds', mode: 'insensitive' } },
        { baseAddress: { contains: 'Maylands', mode: 'insensitive' } },
        { baseAddress: { contains: 'whatley', mode: 'insensitive' } }
      ]
    }
  });

  console.log(`Found ${instructors.length} instructors with Maylands/Whatley addresses\n`);

  for (const instructor of instructors) {
    console.log(`Updating: ${instructor.name}`);
    console.log(`Address: ${instructor.baseAddress}`);
    console.log(`Old coords: (${instructor.baseLatitude}, ${instructor.baseLongitude})`);
    console.log(`New coords: (${maylandsLat}, ${maylandsLng})`);

    await prisma.instructor.update({
      where: { id: instructor.id },
      data: {
        baseLatitude: maylandsLat,
        baseLongitude: maylandsLng,
        baseAddress: '6/226 Whatley Crescent, Maylands WA 6051' // Fix the typo too
      }
    });

    console.log('✅ Updated!\n');
  }

  console.log('=== DONE ===');
  console.log(`Updated ${instructors.length} instructors`);

  await prisma.$disconnect();
}

fixMaylandsCoordinates().catch(console.error);
