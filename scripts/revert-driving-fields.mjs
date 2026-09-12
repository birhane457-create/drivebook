/**
 * Reverts the bad transformation from fix-driving-fields.mjs
 * Fixes:   .vehicleTypes -> as any).vehicleTypes  (bad)
 * Reverts: as any).vehicleTypes -> .vehicleTypes (back to original access)
 * Then we'll add proper (x as any).field casts manually
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = process.cwd()
const SKIP = new Set(['node_modules', '.next', '.git', 'drivebook-hybrid', '.kiro', 'prisma', 'scripts'])

const DRIVING_FIELDS = [
  'vehicleTypes', 'carImage', 'carMake', 'carModel', 'carYear',
  'licenseNumber', 'insuranceNumber', 'offersTestPackage',
  'testPackagePrice', 'testPackageDuration', 'policeCheckDoc',
  'wwcCheckDoc', 'performanceScore', 'lessonFeedback',
  'studentStrengths', 'focusAreas', 'pdaConfigs', 'businessId',
]

let fixed = 0

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full)
    else if (['.ts', '.tsx'].includes(extname(entry))) fixFile(full)
  }
}

function fixFile(path) {
  let content = readFileSync(path, 'utf8')
  const orig = content

  // Revert bad transformation: " as any).field" -> ".field"
  // The script turned ".field" into " as any).field" which broke syntax
  for (const field of DRIVING_FIELDS) {
    content = content.replace(
      new RegExp(` as any\\)\\.${field}\\b`, 'g'),
      `.${field}`
    )
  }

  if (content !== orig) {
    writeFileSync(path, content, 'utf8')
    fixed++
    console.log('  Reverted:', path.replace(ROOT, ''))
  }
}

walk(ROOT)
console.log(`\nReverted ${fixed} files`)
