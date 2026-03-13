const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixLanguagesType() {
  try {
    console.log('Fixing languages field type mismatch...\n');
    
    // Use MongoDB aggregation to find and fix array languages
    const result = await prisma.$runCommandRaw({
      update: 'Instructor',
      updates: [
        {
          q: { languages: { $type: 'array' } },
          u: [
            {
              $set: {
                languages: {
                  $cond: {
                    if: { $isArray: '$languages' },
                    then: {
                      $reduce: {
                        input: '$languages',
                        initialValue: '',
                        in: {
                          $concat: [
                            '$$value',
                            { $cond: [{ $eq: ['$$value', ''] }, '', ', '] },
                            '$$this'
                          ]
                        }
                      }
                    },
                    else: '$languages'
                  }
                }
              }
            }
          ],
          multi: true
        }
      ]
    });
    
    console.log('Update result:', JSON.stringify(result, null, 2));
    console.log('\nLanguages field type fixed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLanguagesType();
