const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPhoneNumbers() {
  console.log('🔧 Fixing phone numbers to international format...\n');

  try {
    // Fix Client phone numbers - get all and filter in JS
    const allClients = await prisma.client.findMany();
    const clients = allClients.filter(c => c.phone && !c.phone.startsWith('+'));

    console.log(`Found ${clients.length} clients with invalid phone format\n`);

    for (const client of clients) {
      let fixedPhone = client.phone;
      
      // Remove any spaces, dashes, or parentheses
      fixedPhone = fixedPhone.replace(/[\s\-\(\)]/g, '');
      
      // If starts with 0, replace with +61
      if (fixedPhone.startsWith('0')) {
        fixedPhone = '+61' + fixedPhone.substring(1);
      }
      // If starts with 61 but no +, add +
      else if (fixedPhone.startsWith('61')) {
        fixedPhone = '+' + fixedPhone;
      }
      // If doesn't start with + or 0 or 61, assume Australian and add +61
      else if (!fixedPhone.startsWith('+')) {
        fixedPhone = '+61' + fixedPhone;
      }

      await prisma.client.update({
        where: { id: client.id },
        data: { phone: fixedPhone }
      });

      console.log(`✅ Fixed: ${client.name}`);
      console.log(`   Old: ${client.phone}`);
      console.log(`   New: ${fixedPhone}\n`);
    }

    // Fix Instructor phone numbers - get all and filter in JS
    const allInstructors = await prisma.instructor.findMany();
    const instructors = allInstructors.filter(i => i.phone && !i.phone.startsWith('+'));

    console.log(`\nFound ${instructors.length} instructors with invalid phone format\n`);

    for (const instructor of instructors) {
      let fixedPhone = instructor.phone;
      
      // Remove any spaces, dashes, or parentheses
      fixedPhone = fixedPhone.replace(/[\s\-\(\)]/g, '');
      
      // If starts with 0, replace with +61
      if (fixedPhone.startsWith('0')) {
        fixedPhone = '+61' + fixedPhone.substring(1);
      }
      // If starts with 61 but no +, add +
      else if (fixedPhone.startsWith('61')) {
        fixedPhone = '+' + fixedPhone;
      }
      // If doesn't start with + or 0 or 61, assume Australian and add +61
      else if (!fixedPhone.startsWith('+')) {
        fixedPhone = '+61' + fixedPhone;
      }

      await prisma.instructor.update({
        where: { id: instructor.id },
        data: { phone: fixedPhone }
      });

      console.log(`✅ Fixed: ${instructor.name}`);
      console.log(`   Old: ${instructor.phone}`);
      console.log(`   New: ${fixedPhone}\n`);
    }

    console.log('\n✅ All phone numbers fixed!');
    console.log('\n📱 Phone numbers are now in international format (+61XXXXXXXXX)');
    console.log('🎉 SMS notifications will now work correctly!');

  } catch (error) {
    console.error('❌ Error fixing phone numbers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPhoneNumbers();
