/**
 * Fix two patterns of broken syntax introduced by bulk migration:
 * 1. (x.foo ?? val,   →  (x as any).foo ?? val,
 * 2. (x.foo || [])   →  (x as any).foo || []
 * 3. someArr || []).map  →  (someArr || []).map  (missing open paren)
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

  // Pattern 1: (x.prop ?? value, — broken open paren, prop has no type
  // e.g. (i.carImage ?? null, → (i as any).carImage ?? null,
  content = content.replace(/\((\w+)\.(\w+)\s+\?\?\s+([^,\n]+),/g, (m, obj, prop, val) => {
    // Only fix if it looks like a broken cast (not already `as any`)
    if (m.includes(' as ')) return m
    return `(${obj} as any).${prop} ?? ${val},`
  })

  // Pattern 2: (x.prop || []) — broken  
  content = content.replace(/\((\w+)\.(\w+)\s+\|\|\s+\[\]\)/g, (m, obj, prop) => {
    if (m.includes(' as ')) return m
    return `(${obj} as any).${prop} || []`
  })

  // Pattern 3: missing open paren before someExpr || []).method
  // e.g.: (earnings as any).foo || []).map  → ((earnings as any).foo || []).map
  content = content.replace(/(?<!\()(\([^)]+\)\s*\|\|\s*\[\])\.(\w+)\(/g, '($1).$2(')

  if (content !== orig) {
    writeFileSync(path, content, 'utf8')
    fixed++
    console.log(`  ✓ ${path.replace(ROOT, '')}`)
  }
}

console.log('\nFixing broken parentheses...\n')
walk(ROOT)
console.log(`\nFixed ${fixed} files`)
