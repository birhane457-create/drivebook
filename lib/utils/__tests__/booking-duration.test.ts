import { describe, expect, it } from 'vitest'
import { formatDurationMinutes, toBookingDurationMinutes } from '@/lib/utils/booking-duration'

describe('client booking duration units', () => {
  it('converts legacy customer lesson hours to canonical minutes', () => {
    expect(toBookingDurationMinutes(1.5, 'customer', 'LESSON')).toBe(90)
  })

  it('leaves minute-based lesson durations unchanged', () => {
    expect(toBookingDurationMinutes(90, 'customer', 'LESSON')).toBe(90)
  })

  it('does not reinterpret short non-customer bookings as hours', () => {
    expect(toBookingDurationMinutes(5, 'provider', 'LESSON')).toBe(5)
  })

  it('formats minute durations for customer-facing display', () => {
    expect(formatDurationMinutes(90)).toBe('1h 30m')
    expect(formatDurationMinutes(30)).toBe('30m')
  })
})
