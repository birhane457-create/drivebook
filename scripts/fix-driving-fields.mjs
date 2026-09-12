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

  // Cast instructor/provider variable when accessing driving-specific fields
  for (const field of DRIVING_FIELDS) {
    // instructor.field -> (instructor as any).field  (but not if already cast)
    content = content.replace(
      new RegExp(`(?<!as any\\))\\.${field}\\b`, 'g'),
      ` as any).${field}`
    )
    // Fix up double-cast: (x as any) as any).field -> (x as any).field
    content = content.replace(/\(([^)]+) as any\) as any\)\./g, '($1 as any).')
  }

  // subscription tier .instructors -> .providers (in tier config objects)
  content = content.replace(/\binstructors\b(?=\s*[}:,\]])/g, 'providers')

  // WeeklyReport.instructors -> .providers
  content = content.replace(/\binstructors(?=:\s*\d)/g, 'providers')

  // customerPhone variable name fix (was renamed to customerName by mistake)  
  // Only fix where customerPhone is used as variable reference, not field name
  content = content.replace(/\bcustomerPhone\b(?!\s*[=:])/g, 'customerPhone')

  if (content !== orig) {
    writeFileSync(path, content, 'utf8')
    fixed++
    console.log('  Fixed:', path.replace(ROOT, ''))
  }
}

walk(ROOT)
console.log(`\nFixed ${fixed} files`)
