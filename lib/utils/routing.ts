// Daily routing logic utilities
import { prisma } from '@/lib/prisma';
import { calculateDistance } from './distance';

export interface InstructorPosition {
  lat: number;
  lng: number;
  source: 'base' | 'previous_lesson';
  label: string;
  isFirstBookingOfDay: boolean;
  previousBookingId?: string;
}

/**
 * Get instructor's current position for a specific booking time
 * Uses daily routing logic:
 * - First booking of day: from base
 * - Subsequent bookings: from previous booking's dropoff location
 */
export async function getInstructorPosition(
  instructorId: string,
  bookingDateTime: Date
): Promise<InstructorPosition> {
  // Get start and end of the booking day
  const dayStart = new Date(bookingDateTime);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(bookingDateTime);
  dayEnd.setHours(23, 59, 59, 999);

  // Find last completed/confirmed booking before this time on same day
  const lastBookingToday = await prisma.booking.findFirst({
    where: {
      instructorId,
      startTime: {
        gte: dayStart,
        lt: bookingDateTime // Before the current booking time
      },
      status: { in: ['CONFIRMED', 'COMPLETED'] }
    },
    orderBy: { endTime: 'desc' }
  });

  // Get instructor's base location
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: {
      baseLatitude: true,
      baseLongitude: true
    }
  });

  if (!instructor) {
    throw new Error('Instructor not found');
  }

  // If there's a booking earlier today with dropoff location, use it
  if (lastBookingToday?.dropoffLatitude && lastBookingToday?.dropoffLongitude) {
    return {
      lat: lastBookingToday.dropoffLatitude,
      lng: lastBookingToday.dropoffLongitude,
      source: 'previous_lesson',
      label: 'from previous lesson',
      isFirstBookingOfDay: false,
      previousBookingId: lastBookingToday.id
    };
  }

  // Otherwise, use base location (first booking of day)
  return {
    lat: instructor.baseLatitude,
    lng: instructor.baseLongitude,
    source: 'base',
    label: 'from base',
    isFirstBookingOfDay: true
  };
}

/**
 * Calculate distance for a booking considering daily routing
 */
export async function calculateBookingDistance(
  instructorId: string,
  clientLat: number,
  clientLng: number,
  bookingDateTime: Date
): Promise<{
  distance: number;
  fromLocation: 'base' | 'previous_lesson';
  label: string;
  isFirstBookingOfDay: boolean;
  travelTimeMinutes: number;
}> {
  const position = await getInstructorPosition(instructorId, bookingDateTime);
  
  const distance = calculateDistance(
    position.lat,
    position.lng,
    clientLat,
    clientLng
  );

  // Estimate travel time (assume 40km/h average in city)
  const travelTimeMinutes = Math.ceil((distance / 40) * 60);

  return {
    distance,
    fromLocation: position.source,
    label: position.label,
    isFirstBookingOfDay: position.isFirstBookingOfDay,
    travelTimeMinutes
  };
}

/**
 * Get instructor's daily route for visualization
 */
export async function getDailyRoute(
  instructorId: string,
  date: Date
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      instructorId,
      startTime: {
        gte: dayStart,
        lte: dayEnd
      },
      status: { in: ['CONFIRMED', 'COMPLETED'] }
    },
    include: {
      client: {
        select: {
          name: true
        }
      }
    },
    orderBy: { startTime: 'asc' }
  });

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: {
      baseLatitude: true,
      baseLongitude: true,
      baseAddress: true
    }
  });

  if (!instructor) {
    return null;
  }

  // Calculate route segments
  const route = [];
  let currentLat = instructor.baseLatitude;
  let currentLng = instructor.baseLongitude;
  let totalDistance = 0;
  let totalTravelTime = 0;

  for (const booking of bookings) {
    if (booking.pickupLatitude && booking.pickupLongitude) {
      const distance = calculateDistance(
        currentLat,
        currentLng,
        booking.pickupLatitude,
        booking.pickupLongitude
      );
      
      const travelTime = Math.ceil((distance / 40) * 60);
      
      route.push({
        bookingId: booking.id,
        clientName: booking.client.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        distance,
        travelTime,
        fromLocation: route.length === 0 ? 'base' : 'previous_lesson'
      });

      totalDistance += distance;
      totalTravelTime += travelTime;

      // Update current position to dropoff (or pickup if no dropoff)
      if (booking.dropoffLatitude && booking.dropoffLongitude) {
        currentLat = booking.dropoffLatitude;
        currentLng = booking.dropoffLongitude;
      } else {
        currentLat = booking.pickupLatitude;
        currentLng = booking.pickupLongitude;
      }
    }
  }

  // Calculate return to base
  const returnDistance = calculateDistance(
    currentLat,
    currentLng,
    instructor.baseLatitude,
    instructor.baseLongitude
  );
  const returnTime = Math.ceil((returnDistance / 40) * 60);

  return {
    baseAddress: instructor.baseAddress,
    baseLocation: {
      lat: instructor.baseLatitude,
      lng: instructor.baseLongitude
    },
    route,
    totalDistance: totalDistance + returnDistance,
    totalTravelTime: totalTravelTime + returnTime,
    returnDistance,
    returnTime,
    bookingCount: bookings.length
  };
}

/**
 * Calculate route efficiency score (0-100)
 * Higher score = less travel, more teaching
 */
export function calculateRouteEfficiency(
  totalTravelTimeMinutes: number,
  totalTeachingTimeMinutes: number
): number {
  const totalTime = totalTravelTimeMinutes + totalTeachingTimeMinutes;
  if (totalTime === 0) return 0;
  
  const efficiency = (totalTeachingTimeMinutes / totalTime) * 100;
  return Math.round(efficiency);
}
