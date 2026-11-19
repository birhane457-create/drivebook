import { describe, expect, it } from 'vitest'
import {
  calculateBookingCartTotal,
  detachPdaFromRemovedLesson,
  removePdaFromCart,
} from '@/lib/utils/client-booking-cart'
import type { PdaCartItem } from '@/lib/utils/client-booking-cart'

const pda = (id: string, parentLessonId?: string): PdaCartItem => ({
  id,
  providerId: 'provider-1',
  instructorName: 'Instructor',
  configId: `config-${id}`,
  configName: 'PDA test',
  testCentreId: 'centre-1',
  testCentreName: 'Test centre',
  testDate: '2099-01-02',
  testTime: '10:00',
  price: 169.99,
  parentLessonId,
})

describe('client booking cart', () => {
  it('keeps a PDA in the cart as standalone when its lesson is removed', () => {
    const remainingPda = detachPdaFromRemovedLesson([pda('pda-1', 'lesson-1')], 'lesson-1')

    expect(remainingPda).toEqual([pda('pda-1')])
    expect(calculateBookingCartTotal([], remainingPda)).toBe(169.99)
  })

  it('removes only the selected PDA and leaves lesson pricing intact', () => {
    const remainingPda = removePdaFromCart([pda('pda-1', 'lesson-1')], 'pda-1')

    expect(remainingPda).toEqual([])
    expect(calculateBookingCartTotal([{ price: 60 }], remainingPda)).toBe(60)
  })

  it('calculates the combined remaining total in cents', () => {
    expect(calculateBookingCartTotal([{ price: 60 }], [pda('pda-1')])).toBe(229.99)
  })
})
