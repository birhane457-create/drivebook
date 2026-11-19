export interface PdaCartItem {
  id: string
  providerId: string
  instructorName: string
  configId: string
  configName: string
  testCentreId: string
  testCentreName: string
  testDate: string
  testTime: string
  price: number
  parentLessonId?: string
}

export function detachPdaFromRemovedLesson(
  pdaBookings: PdaCartItem[],
  lessonId: string,
): PdaCartItem[] {
  return pdaBookings.map(booking =>
    booking.parentLessonId === lessonId
      ? { ...booking, parentLessonId: undefined }
      : booking,
  )
}

export function removePdaFromCart(
  pdaBookings: PdaCartItem[],
  pdaBookingId: string,
): PdaCartItem[] {
  return pdaBookings.filter(booking => booking.id !== pdaBookingId)
}

export function calculateBookingCartTotal(
  lessons: Array<{ price: number }>,
  pdaBookings: Array<{ price: number }>,
): number {
  const totalCents = [...lessons, ...pdaBookings].reduce(
    (total, item) => total + Math.round(item.price * 100),
    0,
  )
  return totalCents / 100
}
