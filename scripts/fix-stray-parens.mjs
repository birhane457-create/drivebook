/**
 * Fix stray closing parens left by previous fix scripts.
 * Pattern: (x as any).prop ?? val), n) → (x as any).prop ?? val, n)
 * i.e. an extra ) was left after the ?? value before a comma+argument.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = 'E:\\DOC\\AI voice assistance - Copy - Copy\\drivebook'
const SKIP = new Set(['node_modules', '.next', '.git', 'drivebook-hybrid', '.kiro', 'scripts', 'prisma'])

let fixed = 0

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full)
    else if (['.ts', '.tsx'].includes(extname(entry))) fix(full)
  }
}

function fix(path) {
  const orig = readFileSync(path, 'utf8')
  let content = orig

  // Fix: (x as any).prop ?? 0), n) → (x as any).prop ?? 0, n)
  // The stray ) comes right after the default value, before the reduce initial value
  // Pattern: .reduce((s, t) => s + (t as any).prop ?? 0), 0)
  // Should be: .reduce((s, t) => s + ((t as any).prop ?? 0), 0)
  content = content.replace(
    /s \+ \((\w+ as any)\)\.(\w+) \?\? (\d+)\), (\d+)\)/g,
    's + (($1).$2 ?? $3), $4)'
  )

  // Fix compliance docStatus calls broken by script:
  // docStatus(exp as any).licenseExpiry || null, i.licenseImageFront).status
  // Should be: docStatus((exp as any).licenseExpiry || null, i.licenseImageFront).status
  content = content.replace(
    /docStatus\(exp as any\)\.(\w+) \|\| null, ([\w.]+)\)/g,
    'docStatus((exp as any).$1 || null, $2)'
  )

  // Fix reviews reduce pattern:
  // sum + (r as any).rating ?? 0), 0) / reviews.length
  content = content.replace(
    /sum \+ \((\w+ as any)\)\.(\w+) \?\? (\d+)\), (\d+)\)/g,
    'sum + (($1).$2 ?? $3), $4)'
  )

  // Fix weekly-payouts reduce:
  content = content.replace(
    /total \+ \((\w+ as any)\)\.(\w+) \?\? (\d+)\), (\d+)\)/g,
    'total + (($1).$2 ?? $3), $4)'
  )

  // Generic: catch all .reduce(... + (x as any).prop ?? n), m) patterns
  content = content.replace(
    /\+ \((\w+ as any)\)\.(\w+) \?\? ([\w.]+)\), ([\w.]+)\)/g,
    '+ (($1).$2 ?? $3), $4)'
  )

  if (content !== orig) {
    writeFileSync(path, content, 'utf8')
    fixed++
    console.log(`  ✓ ${path.replace(ROOT, '')}`)
  }
}

console.log('\nFixing stray parens...\n')
walk(ROOT)
console.log(`\nFixed ${fixed} files`)
