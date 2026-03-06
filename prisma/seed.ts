import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample instructors
  const instructor1 = await prisma.instructor.create({
    data: {
      name: 'John Smith',
      phone: '+61412345678',
      hourlyRate: 65.0,
      serviceAreas: 'Perth Metro, Maylands, Bayswater, Morley',
      copilotAgentEndpoint: null,
    },
  });

  const instructor2 = await prisma.instructor.create({
    data: {
      name: 'Sarah Johnson',
      phone: '+61423456789',
      hourlyRate: 70.0,
      serviceAreas: 'Perth CBD, Northbridge, Mount Lawley, Inglewood',
      copilotAgentEndpoint: null,
    },
  });

  const instructor3 = await prisma.instructor.create({
    data: {
      name: 'Michael Chen',
      phone: '+61434567890',
      hourlyRate: 60.0,
      serviceAreas: 'Belmont, Ascot, Redcliffe, Rivervale',
      copilotAgentEndpoint: null,
    },
  });

  console.log('Created instructors:', {
    instructor1: instructor1.name,
    instructor2: instructor2.name,
    instructor3: instructor3.name,
  });

  // Create sample bookings
  const booking1 = await prisma.booking.create({
    data: {
      instructorId: instructor1.id,
      clientName: 'Alice Brown',
      clientPhone: '+61445678901',
      date: '2026-03-10',
      time: '10:00',
      duration: 60,
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      instructorId: instructor2.id,
      clientName: 'Bob Wilson',
      clientPhone: '+61456789012',
      date: '2026-03-11',
      time: '14:00',
      duration: 90,
    },
  });

  console.log('Created bookings:', {
    booking1: `${booking1.clientName} with ${instructor1.name}`,
    booking2: `${booking2.clientName} with ${instructor2.name}`,
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
