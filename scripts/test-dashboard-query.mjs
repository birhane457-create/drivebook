import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const resolvedProviderId = 'cmsvkfch3002d1wb25jflmjcu'

console.log('Testing dashboard query...')

try {
  const instructor = await prisma.provider.findUnique({
    where: { id: resolvedProviderId },
    include: {
      bookings: {
        where: {
          status: 'CONFIRMED',
          startTime: { gt: new Date() },
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: { client: true },
      },
    },
  })

  console.log('Query succeeded!')
  console.log('Provider name:', instructor?.name)
  console.log('Provider approvalStatus:', instructor?.approvalStatus)
  console.log('Bookings count:', instructor?.bookings?.length)
} catch (error) {
  console.error('Query failed:', error.message)
}

await prisma.$disconnect()
