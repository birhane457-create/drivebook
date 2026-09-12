const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInstructorLocations() {
  console.log('Checking instructor location data...\n');

  const instructors = await prisma.instructor.findMany({
    where: {
      isActive: true,
      approvalStatus: 'APPROVED'
    },
    select: {
      id: true,
      name: true,
      baseLatitude: true,
      baseLongitude: true,
      baseAddress: true,
      serviceRadiusKm: true,
      isActive: true,
      approvalStatus: true
    }
  });

  console.log(`Total active approved instructors: ${instructors.length}\n`);

  let validCount = 0;
  let invalidCount = 0;

  instructors.forEach((instructor, index) => {
    const hasValidCoords = 
      instructor.baseLatitude !== null && 
      instructor.baseLongitude !== null &&
      instructor.baseLatitude !== 0 &&
      instructor.baseLongitude !== 0;

    if (hasValidCoords) {
      validCount++;
      console.log(`✅ ${index + 1}. ${instructor.name}`);
      console.log(`   Base: ${instructor.baseAddress || 'No address'}`);
      console.log(`   Coords: (${instructor.baseLatitude}, ${instructor.baseLongitude})`);
      console.log(`   Radius: ${instructor.serviceRadiusKm}km`);
    } else {
      invalidCount++;
      console.log(`❌ ${index + 1}. ${instructor.name}`);
      console.log(`   Base: ${instructor.baseAddress || 'No address'}`);
      console.log(`   Coords: (${instructor.baseLatitude || 'null'}, ${instructor.baseLongitude || 'null'})`);
      console.log(`   Radius: ${instructor.serviceRadiusKm}km`);
      console.log(`   ⚠️  MISSING VALID COORDINATES!`);
    }
    console.log('');
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Total instructors: ${instructors.length}`);
  console.log(`✅ Valid coordinates: ${validCount}`);
  console.log(`❌ Invalid/missing coordinates: ${invalidCount}`);

  if (invalidCount > 0) {
    console.log('\n⚠️  Some instructors have invalid coordinates!');
    console.log('They need to complete their profile setup with a valid base address.');
  }

  await prisma.$disconnect();
}

checkInstructorLocations().catch(console.error);
