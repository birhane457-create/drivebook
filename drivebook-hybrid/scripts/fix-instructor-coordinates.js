const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simple geocoding function
async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=au`,
      {
        headers: {
          'User-Agent': 'DriveBook-Platform/1.0'
        }
      }
    );

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

async function fixInstructorCoordinates() {
  console.log('Fixing instructor coordinates...\n');

  const instructors = await prisma.instructor.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      name: true,
      baseAddress: true,
      baseLatitude: true,
      baseLongitude: true
    }
  });

  console.log(`Found ${instructors.length} instructors\n`);

  for (const instructor of instructors) {
    console.log(`Processing: ${instructor.name}`);
    console.log(`Current address: ${instructor.baseAddress}`);
    console.log(`Current coords: (${instructor.baseLatitude}, ${instructor.baseLongitude})`);

    // Check if coordinates look wrong (Sydney coordinates when address says Perth/Maylands)
    const isSydneyCoords = 
      instructor.baseLatitude > -34 && 
      instructor.baseLatitude < -33 &&
      instructor.baseLongitude > 150 &&
      instructor.baseLongitude < 152;

    const addressLooksLikePerth = 
      instructor.baseAddress && (
        instructor.baseAddress.toLowerCase().includes('maylands') ||
        instructor.baseAddress.toLowerCase().includes('whatley') ||
        instructor.baseAddress.toLowerCase().includes('6051')
      );

    if (isSydneyCoords && addressLooksLikePerth) {
      console.log('⚠️  Coordinates appear to be Sydney but address is Perth!');
      console.log('Attempting to geocode correct location...');

      // Try to geocode the address
      const coords = await geocodeAddress(instructor.baseAddress + ', WA, Australia');
      
      if (coords) {
        console.log(`✅ Found correct coordinates: (${coords.lat}, ${coords.lng})`);
        console.log(`   Location: ${coords.displayName}`);

        // Update the instructor
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: {
            baseLatitude: coords.lat,
            baseLongitude: coords.lng
          }
        });

        console.log('✅ Updated!');
      } else {
        console.log('❌ Could not geocode address');
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('✓ Coordinates look correct');
    }

    console.log('');
  }

  console.log('\n=== DONE ===');
  await prisma.$disconnect();
}

fixInstructorCoordinates().catch(console.error);
