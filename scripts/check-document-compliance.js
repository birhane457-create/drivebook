/**
 * Document Compliance Checker
 * 
 * Run this script daily (via cron/scheduled task) to:
 * 1. Check for expired documents
 * 2. Deactivate instructors with expired documents
 * 3. Send SMS reminders for expiring documents (< 30 days)
 * 
 * Usage: node scripts/check-document-compliance.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCompliance() {
  console.log('🔍 Checking document compliance...\n');

  const instructors = await prisma.instructor.findMany({
    where: {
      approvalStatus: { in: ['APPROVED'] }
    },
    include: {
      user: {
        select: {
          email: true,
        }
      }
    }
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let deactivated = 0;
  let expiringSoon = 0;

  for (const instructor of instructors) {
    const issues = [];
    let shouldDeactivate = false;
    let shouldRemind = false;

    // Check license
    if (!instructor.licenseExpiry) {
      issues.push('License expiry not set');
      shouldDeactivate = true;
    } else if (instructor.licenseExpiry < now) {
      issues.push('License expired');
      shouldDeactivate = true;
    } else if (instructor.licenseExpiry < thirtyDaysFromNow) {
      issues.push('License expiring soon');
      shouldRemind = true;
    }

    // Check insurance
    if (!instructor.insuranceExpiry) {
      issues.push('Insurance expiry not set');
      shouldDeactivate = true;
    } else if (instructor.insuranceExpiry < now) {
      issues.push('Insurance expired');
      shouldDeactivate = true;
    } else if (instructor.insuranceExpiry < thirtyDaysFromNow) {
      issues.push('Insurance expiring soon');
      shouldRemind = true;
    }

    // Check police check
    if (!instructor.policeCheckExpiry) {
      issues.push('Police check expiry not set');
      shouldDeactivate = true;
    } else if (instructor.policeCheckExpiry < now) {
      issues.push('Police check expired');
      shouldDeactivate = true;
    } else if (instructor.policeCheckExpiry < thirtyDaysFromNow) {
      issues.push('Police check expiring soon');
      shouldRemind = true;
    }

    // Check WWC
    if (!instructor.wwcCheckExpiry) {
      issues.push('WWC check expiry not set');
      shouldDeactivate = true;
    } else if (instructor.wwcCheckExpiry < now) {
      issues.push('WWC check expired');
      shouldDeactivate = true;
    } else if (instructor.wwcCheckExpiry < thirtyDaysFromNow) {
      issues.push('WWC check expiring soon');
      shouldRemind = true;
    }

    if (shouldDeactivate && instructor.isActive) {
      console.log(`🔴 DEACTIVATING: ${instructor.name}`);
      console.log(`   Issues: ${issues.join(', ')}`);
      
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: { isActive: false }
      });

      deactivated++;

      // In production, send SMS here
      console.log(`   📱 Would send SMS to: ${instructor.phone}`);
      console.log(`   Message: Your DriveBook account has been suspended due to expired documents.\n`);
    } else if (shouldRemind && instructor.isActive) {
      console.log(`🟡 REMINDER: ${instructor.name}`);
      console.log(`   Issues: ${issues.join(', ')}`);
      
      expiringSoon++;

      // In production, send SMS here
      console.log(`   📱 Would send SMS to: ${instructor.phone}`);
      console.log(`   Message: Your documents are expiring soon. Update them to avoid suspension.\n`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total instructors checked: ${instructors.length}`);
  console.log(`   🔴 Deactivated: ${deactivated}`);
  console.log(`   🟡 Reminders needed: ${expiringSoon}`);
  console.log(`   🟢 Compliant: ${instructors.length - deactivated - expiringSoon}`);
}

checkCompliance()
  .then(() => {
    console.log('\n✅ Compliance check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
