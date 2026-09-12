const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupStaffSystem() {
  try {
    console.log('🚀 Setting up Staff Management System\n');
    
    // Check if staff members already exist
    const existingStaff = await prisma.staffMember.count();
    
    if (existingStaff > 0) {
      console.log(`✅ Found ${existingStaff} existing staff members`);
      console.log('Staff system already set up!\n');
      return;
    }
    
    console.log('📝 Creating 3 staff members (one per department)...\n');
    
    // Create 3 staff users
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Staff123!', 10);
    
    // 1. Financial Staff
    const financialUser = await prisma.user.create({
      data: {
        email: 'financial@staff.pda.com',
        password: hashedPassword,
        role: 'STAFF'
      }
    });
    
    const financialStaff = await prisma.staffMember.create({
      data: {
        userId: financialUser.id,
        name: 'Financial Manager',
        email: 'financial@staff.pda.com',
        department: 'FINANCIAL',
        skills: ['financial', 'refunds', 'payouts', 'wallet'],
        maxCapacity: 20,
        canAccessFinancials: true,
        workingHours: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '17:00' }],
          wednesday: [{ start: '09:00', end: '17:00' }],
          thursday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '17:00' }]
        }
      }
    });
    
    console.log(`✅ Created Financial Staff: ${financialStaff.email}`);
    
    // 2. Technical Staff
    const technicalUser = await prisma.user.create({
      data: {
        email: 'technical@staff.pda.com',
        password: hashedPassword,
        role: 'STAFF'
      }
    });
    
    const technicalStaff = await prisma.staffMember.create({
      data: {
        userId: technicalUser.id,
        name: 'Technical Support',
        email: 'technical@staff.pda.com',
        department: 'TECHNICAL',
        skills: ['technical', 'calendar', 'booking-system', 'integrations'],
        maxCapacity: 20,
        workingHours: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '17:00' }],
          wednesday: [{ start: '09:00', end: '17:00' }],
          thursday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '17:00' }]
        }
      }
    });
    
    console.log(`✅ Created Technical Staff: ${technicalStaff.email}`);
    
    // 3. Support Staff
    const supportUser = await prisma.user.create({
      data: {
        email: 'support@staff.pda.com',
        password: hashedPassword,
        role: 'STAFF'
      }
    });
    
    const supportStaff = await prisma.staffMember.create({
      data: {
        userId: supportUser.id,
        name: 'Customer Support',
        email: 'support@staff.pda.com',
        department: 'SUPPORT',
        skills: ['support', 'cancellations', 'reschedules', 'disputes'],
        maxCapacity: 25,
        workingHours: {
          monday: [{ start: '08:00', end: '18:00' }],
          tuesday: [{ start: '08:00', end: '18:00' }],
          wednesday: [{ start: '08:00', end: '18:00' }],
          thursday: [{ start: '08:00', end: '18:00' }],
          friday: [{ start: '08:00', end: '18:00' }],
          saturday: [{ start: '10:00', end: '14:00' }]
        }
      }
    });
    
    console.log(`✅ Created Support Staff: ${supportStaff.email}\n`);
    
    // Create some task templates
    console.log('📋 Creating task templates...\n');
    
    const templates = [
      {
        name: 'Refund Request',
        type: 'REFUND_REQUEST',
        category: 'FINANCIAL',
        priority: 'HIGH',
        titleTemplate: 'Refund Request - {clientName}',
        descriptionTemplate: 'Client requesting refund for booking #{bookingId}',
        autoResponseEnabled: true,
        autoResponseMessage: 'Thank you for your refund request. Our financial team will review it within 4 hours.'
      },
      {
        name: 'Calendar Sync Issue',
        type: 'CALENDAR_SYNC_ERROR',
        category: 'TECHNICAL',
        priority: 'HIGH',
        titleTemplate: 'Calendar Sync Error - {instructorName}',
        descriptionTemplate: 'Instructor experiencing calendar synchronization issues',
        autoResponseEnabled: true,
        autoResponseMessage: 'We\'ve received your calendar sync issue. Our technical team is investigating.'
      },
      {
        name: 'Cancellation Request',
        type: 'CANCELLATION_REQUEST',
        category: 'SUPPORT',
        priority: 'NORMAL',
        titleTemplate: 'Cancellation Request - Booking #{bookingId}',
        descriptionTemplate: 'Client requesting to cancel booking',
        autoResponseEnabled: true,
        autoResponseMessage: 'Your cancellation request has been received. We\'ll process it according to our cancellation policy.'
      },
      {
        name: 'Payment Dispute',
        type: 'PAYMENT_DISPUTE',
        category: 'FINANCIAL',
        priority: 'URGENT',
        titleTemplate: 'Payment Dispute - {clientName}',
        descriptionTemplate: 'Client disputing a payment charge',
        autoResponseEnabled: false
      },
      {
        name: 'Booking System Error',
        type: 'BOOKING_ISSUE',
        category: 'TECHNICAL',
        priority: 'URGENT',
        titleTemplate: 'Booking System Error',
        descriptionTemplate: 'Critical booking system error reported',
        autoResponseEnabled: false
      }
    ];
    
    for (const template of templates) {
      await prisma.taskTemplate.create({ data: template });
      console.log(`✅ Created template: ${template.name}`);
    }
    
    console.log('\n🎉 Staff Management System Setup Complete!\n');
    console.log('📧 Staff Login Credentials:');
    console.log('   Financial: financial@staff.pda.com / Staff123!');
    console.log('   Technical: technical@staff.pda.com / Staff123!');
    console.log('   Support: support@staff.pda.com / Staff123!\n');
    console.log('🔐 Please change these passwords after first login!\n');
    
  } catch (error) {
    console.error('❌ Error setting up staff system:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupStaffSystem();
