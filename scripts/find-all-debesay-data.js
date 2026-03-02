/**
 * Find all data related to Debesay across the system
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findAllDebesayData() {
  console.log('🔍 Searching for all Debesay-related data\n');

  try {
    // Find all instructors with similar names
    const instructors = await prisma.instructor.findMany({
      where: {
        OR: [
          { name: { contains: 'Debesay', mode: 'insensitive' } },
          { name: { contains: 'Birhane', mode: 'insensitive' } },
        ],
      },
      include: {
        user: { select: { email: true } },
      },
    });

    console.log(`📋 Found ${instructors.length} instructor(s):\n`);
    for (const inst of instructors) {
      console.log(`  Name: ${inst.name}`);
      console.log(`  Email: ${inst.user.email}`);
      console.log(`  ID: ${inst.id}`);
      console.log(`  Total Bookings: ${inst.totalBookings}`);
      console.log('');
    }

    // Find all clients with similar names
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: 'Debesay', mode: 'insensitive' } },
          { name: { contains: 'Birhane', mode: 'insensitive' } },
        ],
      },
      include: {
        instructor: { select: { name: true } },
      },
    });

    console.log(`👥 Found ${clients.length} client(s):\n`);
    for (const client of clients) {
      console.log(`  Name: ${client.name}`);
      console.log(`  Email: ${client.email}`);
      console.log(`  Instructor: ${client.instructor.name}`);
      console.log(`  ID: ${client.id}`);
      console.log('');
    }

    // Find all bookings for the main instructor
    if (instructors.length > 0) {
      const mainInstructor = instructors[0];
      
      const allBookings = await prisma.booking.findMany({
        where: { instructorId: mainInstructor.id },
        include: {
          client: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log(`📊 Total Bookings for ${mainInstructor.name}: ${allBookings.length}\n`);

      // Check for package bookings
      const packageBookings = allBookings.filter((b) => b.isPackageBooking);
      const parentPackages = packageBookings.filter((b) => !b.parentBookingId);
      const childPackages = packageBookings.filter((b) => b.parentBookingId);

      console.log('Package Breakdown:');
      console.log(`  Parent Packages: ${parentPackages.length}`);
      console.log(`  Child Packages: ${childPackages.length}`);
      console.log(`  Single Bookings: ${allBookings.length - packageBookings.length}`);
      console.log('');

      // Check for bookings with packageHours
      const withPackageHours = allBookings.filter((b) => b.packageHours && b.packageHours > 0);
      console.log(`Bookings with packageHours: ${withPackageHours.length}`);
      if (withPackageHours.length > 0) {
        console.log('\nPackage Hours Details:');
        withPackageHours.forEach((b) => {
          console.log(`  ${b.client.name} | ${b.packageHours}h | $${b.price} | ${b.status}`);
        });
      }
      console.log('');

      // Show all bookings grouped by client
      const byClient = {};
      allBookings.forEach((b) => {
        if (!byClient[b.client.name]) {
          byClient[b.client.name] = [];
        }
        byClient[b.client.name].push(b);
      });

      console.log('📋 Bookings by Client:');
      Object.entries(byClient).forEach(([clientName, bookings]) => {
        console.log(`\n  ${clientName}: ${bookings.length} booking(s)`);
        bookings.forEach((b, i) => {
          const pkgInfo = b.isPackageBooking
            ? b.parentBookingId
              ? ' [Child]'
              : ' [Parent]'
            : '';
          console.log(
            `    ${i + 1}. ${b.startTime.toLocaleDateString()} | ${b.status} | $${b.price}${pkgInfo}`
          );
        });
      });
    }

    // Check for any incomplete bookings
    const incompleteBookings = await prisma.incompleteBooking.findMany({
      where: {
        instructor: {
          name: { contains: 'Debesay', mode: 'insensitive' },
        },
      },
    });

    if (incompleteBookings.length > 0) {
      console.log(`\n⏳ Found ${incompleteBookings.length} incomplete booking(s)`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

findAllDebesayData();
