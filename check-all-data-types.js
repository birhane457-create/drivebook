const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDataTypes() {
  try {
    console.log('Checking for data type mismatches...\n');
    
    // Check for array types that should be strings
    const arrayChecks = await prisma.$runCommandRaw({
      aggregate: 'Instructor',
      pipeline: [
        {
          $project: {
            _id: 1,
            name: 1,
            hasArrayLanguages: { $eq: [{ $type: '$languages' }, 'array'] },
            hasArrayVehicleTypes: { $eq: [{ $type: '$vehicleTypes' }, 'array'] },
            hasNumberCarYear: { $eq: [{ $type: '$carYear' }, 'number'] }
          }
        },
        {
          $match: {
            $or: [
              { hasArrayLanguages: true },
              { hasArrayVehicleTypes: true },
              { hasNumberCarYear: true }
            ]
          }
        }
      ],
      cursor: {}
    });
    
    if (arrayChecks.cursor.firstBatch.length > 0) {
      console.log('Found instructors with data type issues:');
      arrayChecks.cursor.firstBatch.forEach(doc => {
        console.log(`\n- ${doc.name} (${doc._id}):`);
        if (doc.hasArrayLanguages) console.log('  ❌ languages is array (should be string)');
        if (doc.hasArrayVehicleTypes) console.log('  ❌ vehicleTypes is array (should be string)');
        if (doc.hasNumberCarYear) console.log('  ❌ carYear is number (should be string)');
      });
    } else {
      console.log('✅ All data types are correct!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDataTypes();
