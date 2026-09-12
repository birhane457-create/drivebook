const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugBookings() {
  try {
    const email = 'birhane457@gmail.com';
    
    console.log('\n🔍 Debugging mobile bookings for:', email);
    console.log('='.repeat(50));
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        instructor: true,
      },
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('\n✅ User found:');
    console.log('  User ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Has instructor:', !!user.instructor);
    
    if (user.instructor) {
      console.log('  Instructor ID:', user.instructor.id);
      console.log('  Instructor Name:', user.instructor.name);
      
      // Find bookings
      const bookings = await prisma.booking.findMany({
        where: {
          instructorId: user.instructor.id,
        },
        include: {
          client: true,
        },
        orderBy: {
          startTime: 'desc',
        },
      });
      
      console.log('\n📅 Bookings found:', bookings.length);
      
      if (bookings.length > 0) {
        console.log('\nBooking details:');
        bookings.forEach((booking, index) => {
          console.log(`\n  ${index + 1}. Booking ID: ${booking.id}`);
          console.log(`     Client: ${booking.client.name}`);
          console.log(`     Date: ${booking.startTime.toISOString().split('T')[0]}`);
          console.log(`     Time: ${booking.startTime.toLocaleTimeString()} - ${booking.endTime.toLocaleTimeString()}`);
          console.log(`     Status: ${booking.status}`);
          console.log(`     Instructor ID: ${booking.instructorId}`);
        });
      } else {
        console.log('\n❌ No bookings found for this instructor');
        
        // Check if there are any bookings at all
        const allBookings = await prisma.booking.findMany({
          select: {
            id: true,
            instructorId: true,
          },
        });
        
        console.log('\n📊 Total bookings in database:', allBookings.length);
        if (allBookings.length > 0) {
          console.log('   Instructor IDs in bookings:');
          const uniqueInstructorIds = [...new Set(allBookings.map(b => b.instructorId))];
          uniqueInstructorIds.forEach(id => {
            const count = allBookings.filter(b => b.instructorId === id).length;
            console.log(`     - ${id}: ${count} bookings`);
          });
        }
      }
    } else {
      console.log('\n❌ User is not an instructor');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugBookings();
