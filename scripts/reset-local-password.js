#!/usr/bin/env node
/*
  Usage: node scripts/reset-local-password.js user@example.com newPassword
  Loads .env, connects to Prisma DB, finds the user by email and sets a new hashed password.
*/
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env')
  if (!fs.existsSync(envPath)) return
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    let key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnv()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const [,, email, password] = process.argv
  if (!email || !password) {
    console.error('Usage: node scripts/reset-local-password.js user@example.com newPassword')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.error('User not found:', email)
      process.exit(2)
    }

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, resetToken: null, resetTokenExpiry: null } })
    console.log(`Password for ${email} updated successfully.`)
  } catch (err) {
    console.error('Error resetting password:', err)
    process.exit(3)
  } finally {
    await prisma.$disconnect()
  }
}

main()
