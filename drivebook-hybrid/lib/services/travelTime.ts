// Travel time calculation service
// Estimates travel time between two addresses

interface TravelTimeResult {
  durationMinutes: number
  distanceKm: number
}

/**
 * Calculate travel time between two addresses
 * Uses Google Maps Distance Matrix API if available, otherwise estimates
 */
export async function calculateTravelTime(
  fromAddress: string,
  toAddress: string
): Promise<TravelTimeResult> {
  // If Google Maps API key is available, use it
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'your-google-maps-api-key') {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?` +
        `origins=${encodeURIComponent(fromAddress)}&` +
        `destinations=${encodeURIComponent(toAddress)}&` +
        `key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )

      const data = await response.json()

      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const element = data.rows[0].elements[0]
        return {
          durationMinutes: Math.ceil(element.duration.value / 60), // Convert seconds to minutes, round up
          distanceKm: element.distance.value / 1000 // Convert meters to km
        }
      }
    } catch (error) {
      console.error('Google Maps API error:', error)
      // Fall through to estimation
    }
  }

  // Fallback: Estimate based on typical city driving
  // Assume average speed of 30 km/h in city traffic
  // This is a rough estimate - actual time will vary
  const estimatedDistanceKm = 5 // Assume 5km average distance
  const averageSpeedKmh = 30
  const estimatedMinutes = Math.ceil((estimatedDistanceKm / averageSpeedKmh) * 60)

  return {
    durationMinutes: Math.max(10, Math.min(estimatedMinutes, 30)), // Between 10-30 minutes
    distanceKm: estimatedDistanceKm
  }
}

/**
 * Calculate travel time to next booking
 * Gets the previous booking's end location and calculates travel to new booking's start location
 */
export async function calculateTravelTimeToNextBooking(
  instructorId: string,
  newBookingStartTime: Date,
  newBookingPickupAddress: string,
  prisma: any
): Promise<number> {
  // Get instructor's configured travel buffer
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { bookingBufferMinutes: true, travelTimeMinutes: true, enableTravelTime: true }
  })
  
  // Use booking buffer + optional travel time
  const defaultBuffer = instructor?.bookingBufferMinutes || 15
  const extraTravelTime = (instructor?.enableTravelTime && instructor?.travelTimeMinutes) ? instructor.travelTimeMinutes : 0
  const totalBuffer = defaultBuffer + extraTravelTime

  // Find the booking that ends just before this new booking
  const previousBooking = await prisma.booking.findFirst({
    where: {
      instructorId,
      endTime: {
        lte: newBookingStartTime
      },
      status: {
        in: ['PENDING', 'CONFIRMED']
      }
    },
    orderBy: {
      endTime: 'desc'
    },
    select: {
      dropoffAddress: true,
      pickupAddress: true
    }
  })

  if (!previousBooking) {
    // No previous booking, no travel time needed
    return 0
  }

  // Use dropoff address if available, otherwise pickup address
  const fromAddress = previousBooking.dropoffAddress || previousBooking.pickupAddress

  if (!fromAddress || !newBookingPickupAddress) {
    // Can't calculate without addresses, use instructor's configured buffer
    return totalBuffer
  }

  try {
    const result = await calculateTravelTime(fromAddress, newBookingPickupAddress)
    return result.durationMinutes
  } catch (error) {
    console.error('Travel time calculation error:', error)
    return totalBuffer // Use instructor's configured buffer
  }
}
