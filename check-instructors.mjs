import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInstructors() {
  try {
    // Get total instructors
    const totalInstructors = await prisma.instructor.count();
    
    // Get active instructors (assuming active means they have accepted status or bookings)
    const instructorsWithDetails = await prisma.instructor.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        businessName: true,
        abn: true,
        abnVerified: true,
        gstRegistered: true,
        status: true,
        hourlyRate: true,
        user: {
          select: {
            email: true,
          }
        },
        _count: {
          select: {
            bookings: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('\n=== INSTRUCTOR DATABASE CHECK ===\n');
    console.log(`Total instructors: ${totalInstructors}`);
    console.log(`\nSample instructors (most recent):\n`);
    
    instructorsWithDetails.forEach((inst, i) => {
      console.log(`${i + 1}. ${inst.name || 'Unknown'}`);
      console.log(`   ID: ${inst.id}`);
      console.log(`   Email: ${inst.user?.email || 'N/A'}`);
      console.log(`   Business: ${inst.businessName || 'N/A'}`);
      console.log(`   ABN: ${inst.abn || 'N/A'} (Verified: ${inst.abnVerified})`);
      console.log(`   GST: ${inst.gstRegistered ? 'YES' : 'NO'}`);
      console.log(`   Status: ${inst.status}`);
      console.log(`   Rate: $${inst.hourlyRate || 0}/hr`);
      console.log(`   Bookings: ${inst._count.bookings}`);
      console.log('');
    });

    // Check for instructors with complete profiles
    const completeProfiles = await prisma.instructor.count({
      where: {
        AND: [
          { name: { not: null } },
          { abn: { not: null } },
          { abnVerified: true },
          { hourlyRate: { gt: 0 } }
        ]
      }
    });

    console.log(`Instructors with complete profiles: ${completeProfiles}`);
    console.log(`Instructors registered for GST: ${instructorsWithDetails.filter(i => i.gstRegistered).length} / ${instructorsWithDetails.length} (sample)`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkInstructors();
