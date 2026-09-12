const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicateEmails() {
  console.log('🔍 Checking for Duplicate Email Accounts\n');

  try {
    // Check User table for duplicate emails
    console.log('📧 Checking User table...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { email: 'asc' }
    });

    // Group by email
    const emailGroups = {};
    for (const user of users) {
      if (!emailGroups[user.email]) {
        emailGroups[user.email] = [];
      }
      emailGroups[user.email].push(user);
    }

    // Find duplicates
    const duplicates = Object.entries(emailGroups).filter(([email, users]) => users.length > 1);

    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate emails in User table:\n`);
      
      for (const [email, users] of duplicates) {
        console.log(`   Email: ${email}`);
        console.log(`   Accounts: ${users.length}\n`);
        
        for (const user of users) {
          console.log(`      ID: ${user.id}`);
          console.log(`      Role: ${user.role}`);
          console.log(`      Created: ${user.createdAt.toLocaleString()}\n`);
        }
      }
    } else {
      console.log('✅ No duplicate emails found in User table\n');
    }

    // Check Client table for duplicate emails
    console.log('\n📧 Checking Client table...\n');
    
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        userId: true,
        instructorId: true,
        createdAt: true
      },
      orderBy: { email: 'asc' }
    });

    // Group by email
    const clientEmailGroups = {};
    for (const client of clients) {
      if (!clientEmailGroups[client.email]) {
        clientEmailGroups[client.email] = [];
      }
      clientEmailGroups[client.email].push(client);
    }

    // Find duplicates
    const clientDuplicates = Object.entries(clientEmailGroups).filter(([email, clients]) => clients.length > 1);

    if (clientDuplicates.length > 0) {
      console.log(`⚠️  Found ${clientDuplicates.length} duplicate emails in Client table:\n`);
      
      for (const [email, clients] of clientDuplicates) {
        console.log(`   Email: ${email}`);
        console.log(`   Client Records: ${clients.length}\n`);
        
        for (const client of clients) {
          console.log(`      Client ID: ${client.id}`);
          console.log(`      Name: ${client.name}`);
          console.log(`      User ID: ${client.userId || 'Not linked'}`);
          console.log(`      Instructor ID: ${client.instructorId}`);
          console.log(`      Created: ${client.createdAt.toLocaleString()}\n`);
        }
      }
      
      console.log('   ℹ️  Note: Multiple Client records per email is EXPECTED');
      console.log('   Each instructor can have their own Client record for the same email\n');
    } else {
      console.log('✅ No duplicate emails found in Client table\n');
    }

    // Check schema constraints
    console.log('\n🔒 Checking Schema Constraints...\n');
    
    // Read schema file to check for unique constraints
    const fs = require('fs');
    const schemaPath = 'prisma/schema.prisma';
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Check User model
      const userModelMatch = schema.match(/model User \{[\s\S]*?\n\}/);
      if (userModelMatch) {
        const userModel = userModelMatch[0];
        const hasUniqueEmail = userModel.includes('email') && (
          userModel.includes('@unique') || 
          userModel.includes('@@unique([email])')
        );
        
        if (hasUniqueEmail) {
          console.log('   ✅ User.email has @unique constraint');
        } else {
          console.log('   ❌ User.email does NOT have @unique constraint');
        }
      }
      
      // Check Client model
      const clientModelMatch = schema.match(/model Client \{[\s\S]*?\n\}/);
      if (clientModelMatch) {
        const clientModel = clientModelMatch[0];
        const hasUniqueEmail = clientModel.includes('email') && (
          clientModel.includes('@unique') || 
          clientModel.includes('@@unique([email])')
        );
        
        if (hasUniqueEmail) {
          console.log('   ⚠️  Client.email has @unique constraint (may cause issues)');
        } else {
          console.log('   ✅ Client.email does NOT have @unique constraint (correct)');
        }
      }
    }

    // Summary
    console.log('\n\n📊 Summary:\n');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Duplicate User Emails: ${duplicates.length}`);
    console.log(`   Total Clients: ${clients.length}`);
    console.log(`   Duplicate Client Emails: ${clientDuplicates.length} (expected)\n`);

    // Recommendations
    console.log('\n💡 Recommendations:\n');
    
    if (duplicates.length > 0) {
      console.log('   ❌ CRITICAL: Duplicate User emails found!');
      console.log('   Action: Add @unique constraint to User.email');
      console.log('   Action: Merge or delete duplicate accounts\n');
    } else {
      console.log('   ✅ User emails are unique (good)\n');
    }
    
    console.log('   ✅ Client emails can have duplicates (one per instructor)');
    console.log('   This is correct behavior - same client can book multiple instructors\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateEmails();
