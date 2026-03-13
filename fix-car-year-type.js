const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCarYearType() {
  try {
    console.log('Fixing carYear field types...\n');

    // Use raw MongoDB command to update
    const result = await prisma.$runCommandRaw({
      update: 'Instructor',
      updates: [
        {
          q: { carYear: { $type: 'number' } },
          u: [{ $set: { carYear: { $toString: '$carYear' } } }],
          multi: true
        }
      ]
    });

    console.log('Update result:', result);
    console.log('\n✓ All carYear fields converted to strings!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCarYearType();
