// @ts-nocheck
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { addHours, subHours } from 'date-fns'

export class PDAService {
  async createPDATest(data: {
    providerId: string
    customerId: string
    testCenterLatitude: number
    testCenterLongitude: number
    testCenterName: string
    testCenterAddress: string
    testDate: Date
    testTime: string
  }) {
    const pdaTest = await prisma.pDATest.create({
      data,
      include: { customer: true,
        instructor: true
      }
    })

    await this.blockTestPreparation(pdaTest.id)
    
    return pdaTest
  }

  async blockTestPreparation(testId: string) {
    const test = await prisma.pDATest.findUnique({
      where: { id: testId },
      include: {
        provider: true,
        customer: true
      }
    })

    if (!test) throw new Error('PDA test not found')

    const [hours, minutes] = test.testTime.split(':').map(Number)
    const testDateTime = new Date(test.testDate)
    testDateTime.setHours(hours, minutes, 0, 0)

    const blockStart = subHours(testDateTime, 2)
    const blockEnd = addHours(testDateTime, 1)

    await prisma.availabilityException.create({
      data: {
        providerId: test.providerId,
        exceptionDate: test.testDate,
        startTime: blockStart.toTimeString().slice(0, 5),
        endTime: blockEnd.toTimeString().slice(0, 5),
        reason: 'PDA_TEST_PREP'
      }
    })

    await this.scheduleReminders(test.id)
  }

  async scheduleReminders(testId: string) {
    const test = await prisma.pDATest.findUnique({
      where: { id: testId },
      include: {
        customer: true,
        provider: {
          select: {
            name: true,
            businessName: true,    // White-label: shown to customers for PREMIUM tier
            accountType: true,     // Legal entity — INDIVIDUAL or BUSINESS (not subscriptionTier)
            subscriptionTier: true, // Subscription plan — BASIC/PRO/STUDIO/PREMIUM
          }
        }
      }
    })

    if (!test) return

    await emailService.sendPDATestReminder({
      customerName: test.customer.name,
      customerEmail: test.customer.email,
      provider: test.provider,  // Pass full provider object — email service uses getDisplayName for white-label
      testDate: test.testDate,
      testTime: test.testTime,
      testCenter: test.testCenterName
    })
  }
}

export const pdaService = new PDAService()
