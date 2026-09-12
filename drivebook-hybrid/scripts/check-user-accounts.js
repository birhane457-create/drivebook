const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserAccounts() {
  try {
    console.log('Checking user accounts...\n');

    // Check admin@church.org
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@church.org' },
      include: {
        clients: true,
        wallet: true
      }
    });

    if (adminUser) {
      console.log('✅ admin@church.org:');
      console.log(`   User ID: ${adminUser.id}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Client records: ${adminUser.clients.length}`);
      if (adminUser.clients.length > 0) {
        adminUser.clients.forEach((c, i) => {
          console.log(`     ${i + 1}. Client ID: ${c.id}, Name: ${c.name}, Email: ${c.email}`);
        });
      }
      console.log(`   Has wallet: ${adminUser.wallet ? 'Yes' : 'No'}`);
      if (adminUser.wallet) {
        console.log(`   Wallet balance: $${adminUser.wallet.totalPaid}`);
      }
    } else {
      console.log('❌ admin@church.org not found');
    }

    console.log('\n---\n');

    // Check debesay304@gmail.com
    const debesayUser = await prisma.user.findUnique({
      where: { email: 'debesay304@gmail.com' },
      include: {
        clients: true,
        wallet: true
      }
    });

    if (debesayUser) {
      console.log('✅ debesay304@gmail.com:');
      console.log(`   User ID: ${debesayUser.id}`);
      console.log(`   Role: ${debesayUser.role}`);
      console.log(`   Client records: ${debesayUser.clients.length}`);
      if (debesayUser.clients.length > 0) {
        debesayUser.clients.forEach((c, i) => {
          console.log(`     ${i + 1}. Client ID: ${c.id}, Name: ${c.name}, Email: ${c.email}`);
        });
      }
      console.log(`   Has wallet: ${debesayUser.wallet ? 'Yes' : 'No'}`);
      if (debesayUser.wallet) {
        console.log(`   Wallet balance: $${debesayUser.wallet.totalPaid}`);
      }
    } else {
      console.log('❌ debesay304@gmail.com not found');
    }

    console.log('\n---\n');

    // Check all client records with email debesay304@gmail.com
    const debesayClients = await prisma.client.findMany({
      where: {
        email: 'debesay304@gmail.com'
      },
      include: {
        user: {
          select: {
            email: true,
            role: true
          }
        },
        instructor: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`📋 Client records with email debesay304@gmail.com: ${debesayClients.length}`);
    debesayClients.forEach((c, i) => {
      console.log(`\n${i + 1}. Client ID: ${c.id}`);
      console.log(`   Name: ${c.name}`);
      console.log(`   Instructor: ${c.instructor.name}`);
      console.log(`   User ID: ${c.userId || 'null'}`);
      console.log(`   User Email: ${c.user?.email || 'No user account'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserAccounts();
