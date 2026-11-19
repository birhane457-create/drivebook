export function toBookingDurationMinutes(
  duration: number | null | undefined,
  createdBy?: string | null,
  bookingType?: string | null,
): number | null {
  if (duration == null) return null

  // Legacy wallet bookings stored lesson duration in hours; all current writes use minutes.
  if (bookingType === 'LESSON' && createdBy === 'customer' && duration > 0 && duration <= 8) {
    return duration * 60
  }

  return duration
}

export function formatDurationMinutes(duration: number): string {
  const wholeMinutes = Math.round(duration)
  const hours = Math.floor(wholeMinutes / 60)
  const minutes = wholeMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
