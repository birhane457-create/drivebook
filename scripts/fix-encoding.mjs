/**
 * Fix UTF-8 encoding issues across all TypeScript files.
 * Re-encodes files that have BOM or invalid UTF-8 sequences.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')
  .replace(/%20/g, ' ')
  .replace(/\//g, '\\')
  .replace(/\\$/, '')

const SKIP = new Set(['node_modules', '.next', '.git', 'drivebook-hybrid', '.kiro', 'scripts'])

let fixed = 0

function walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue
    const fullPath = join(dir, entry)
    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) { walk(fullPath); continue }
      if (!['.ts', '.tsx'].includes(extname(entry))) continue
    } catch { continue }

    try {
      const bytes = readFileSync(fullPath)
      // Check for BOM
      const hasBom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
      // Try decoding as UTF-8
      let text
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        // Invalid UTF-8 — decode as latin1 then re-encode as UTF-8
        text = new TextDecoder('latin1').decode(bytes)
        writeFileSync(fullPath, Buffer.from(text, 'utf8'))
        console.log(`  Re-encoded (latin1→utf8): ${fullPath.replace(ROOT + '\\', '')}`)
        fixed++
        continue
      }
      if (hasBom) {
        // Strip BOM
        text = text.replace(/^\uFEFF/, '')
        writeFileSync(fullPath, Buffer.from(text, 'utf8'))
        console.log(`  Stripped BOM: ${fullPath.replace(ROOT + '\\', '')}`)
        fixed++
      }
    } catch (e) {
      console.warn(`  Skip ${entry}: ${e.message}`)
    }
  }
}

console.log('Fixing encoding issues...\n')
walk(ROOT)
console.log(`\nFixed ${fixed} files`)
