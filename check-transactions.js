const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTransactions() {
  try {
    console.log('Checking for transactions with null bookingId...\n');
    
    // Use MongoDB aggregation to find null bookingIds
    const result = await prisma.$runCommandRaw({
      aggregate: 'Transaction',
      pipeline: [
        {
          $match: {
            bookingId: null
          }
        },
        {
          $project: {
            _id: 1,
            type: 1,
            amount: 1,
            status: 1,
            instructorId: 1,
            createdAt: 1
          }
        }
      ],
      cursor: {}
    });
    
    const nullTransactions = result.cursor.firstBatch;
    
    if (nullTransactions.length > 0) {
      console.log(`Found ${nullTransactions.length} transactions with null bookingId:\n`);
      nullTransactions.forEach(tx => {
        console.log(`- ID: ${tx._id}`);
        console.log(`  Type: ${tx.type}`);
        console.log(`  Amount: ${tx.amount}`);
        console.log(`  Status: ${tx.status}`);
        console.log(`  InstructorId: ${tx.instructorId}`);
        console.log(`  Created: ${tx.createdAt}`);
        console.log('');
      });
    } else {
      console.log('✅ No transactions with null bookingId found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();
