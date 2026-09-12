/**
 * Create the initial SUPER_ADMIN account directly in the database.
 * Run once after fresh database setup.
 *
 * Usage: node create-admin.js
 *
 * This bypasses the HTTP layer entirely — no public endpoint needed.
 * The /admin/register HTTP endpoint should be disabled in production.
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({
  datasources: {
    db: {
      // Use direct connection for scripts (not pooler)
      url: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
    },
  },
})

// ── Configure your admin credentials here ────────────────────────────────────
const ADMIN_EMAIL = 'debesay304@gmail.com'
const ADMIN_PASSWORD = 'DriveBook2026!'  // Change this after first login
// ─────────────────────────────────────────────────────────────────────────────

async function createAdmin() {
  console.log('Creating SUPER_ADMIN account...')

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    console.log(`User ${ADMIN_EMAIL} already exists (role: ${existing.role})`)
    if (existing.role !== 'SUPER_ADMIN') {
      await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { role: 'SUPER_ADMIN' } })
      console.log('Role updated to SUPER_ADMIN')
    }
    return
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashed,
      role: 'SUPER_ADMIN',
      name: 'Admin',
    },
  })

  console.log(`✅ SUPER_ADMIN created: ${user.email}`)
  console.log(`   Login at /login with: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`   Change your password after first login.`)
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
