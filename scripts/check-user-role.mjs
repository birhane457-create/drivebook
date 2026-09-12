import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const user = await prisma.user.findUnique({
  where: { email: 'birhane157@gmail.com' },
  include: { provider: true }
})

console.log('User role:', user?.role)
console.log('Provider ID:', user?.provider?.id)
console.log('Provider exists:', !!user?.provider)

await prisma.$disconnect()
