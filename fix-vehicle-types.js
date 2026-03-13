const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVehicleTypes() {
  try {
    console.log('Fixing vehicleTypes field...\n');

    // Convert arrays to comma-separated strings
    const result = await prisma.$runCommandRaw({
      update: 'Instructor',
      updates: [
        {
          q: { vehicleTypes: { $type: 'array' } },
          u: [{
            $set: {
              vehicleTypes: {
                $reduce: {
                  input: '$vehicleTypes',
                  initialValue: '',
                  in: {
                    $concat: [
                      '$$value',
                      { $cond: [{ $eq: ['$$value', ''] }, '', ', '] },
                      '$$this'
                    ]
                  }
                }
              }
            }
          }],
          multi: true
        }
      ]
    });

    console.log('Update result:', result);
    console.log('\n✓ All vehicleTypes fields converted to strings!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixVehicleTypes();
