/**
 * Check instructor documents in database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocuments() {
  console.log('📋 Checking instructor documents...\n');

  const instructors = await prisma.instructor.findMany({
    select: {
      id: true,
      name: true,
      licenseImageFront: true,
      licenseImageBack: true,
      insurancePolicyDoc: true,
      policeCheckDoc: true,
      wwcCheckDoc: true,
      photoIdDoc: true,
      certificationDoc: true,
      vehicleRegistrationDoc: true,
      user: {
        select: {
          email: true,
        }
      }
    }
  });

  for (const instructor of instructors) {
    console.log(`\n👤 ${instructor.name} (${instructor.user.email})`);
    console.log(`   ID: ${instructor.id}`);
    console.log(`   License Front: ${instructor.licenseImageFront ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   License Back: ${instructor.licenseImageBack ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   Insurance: ${instructor.insurancePolicyDoc ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   Police Check: ${instructor.policeCheckDoc ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   WWC Check: ${instructor.wwcCheckDoc ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   Photo ID: ${instructor.photoIdDoc ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   Certification: ${instructor.certificationDoc ? '✓ Uploaded' : '✗ Missing'}`);
    console.log(`   Vehicle Reg: ${instructor.vehicleRegistrationDoc ? '✓ Uploaded' : '✗ Missing'}`);
  }

  console.log(`\n\n📊 Total instructors: ${instructors.length}`);
}

checkDocuments()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
