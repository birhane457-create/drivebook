import { prisma } from '../prisma'
import { emailService } from './email'
import { addHours, subHours } from 'date-fns'

export class PDAService {
  async createPDATest(data: {
    instructorId: string
    clientId: string
    testCenterLatitude: number
    testCenterLongitude: number
    testCenterName: string
    testCenterAddress: string
    testDate: Date
    testTime: string
  }) {
    const pdaTest = await prisma.pDATest.create({
      data,
      include: {
        client: true,
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
        instructor: true,
        client: true
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
        instructorId: test.instructorId,
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
        client: true,
        instructor: true
      }
    })

    if (!test) return

    await emailService.sendPDATestReminder({
      clientName: test.client.name,
      clientEmail: test.client.email,
      instructorName: test.instructor.name,
      testDate: test.testDate,
      testTime: test.testTime,
      testCenter: test.testCenterName
    })
  }
}

export const pdaService = new PDAService()
