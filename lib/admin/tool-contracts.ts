/**
 * Tool Result Contract — P1-01
 *
 * DECISION: D-01
 * FINDING:  C-1 — database failures silently converted to valid business zeros
 *
 * Every tool in lib/admin/ai-tools.ts must return one of these statuses.
 * An ERROR must never become a valid business zero or empty result.
 *
 * Migration pattern:
 *   OLD: (prisma.booking.count(...) as any).catch(() => 0)
 *   NEW: await safeQuery(() => prisma.booking.count(...))
 *       then check result.status before using result.data
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core result type
// ─────────────────────────────────────────────────────────────────────────────

export type ToolResult<T> =
  | { status: 'SUCCESS';  data: T }
  | { status: 'EMPTY';    reason: string }
  | { status: 'PARTIAL';  data: T; missing: string[] }
  | { status: 'ERROR';    error: string }
  | { status: 'UNKNOWN';  reason: string }

// ─────────────────────────────────────────────────────────────────────────────
// Builder helpers
// ─────────────────────────────────────────────────────────────────────────────

export function ok<T>(data: T): ToolResult<T> {
  return { status: 'SUCCESS', data }
}

export function empty(reason: string): ToolResult<never> {
  return { status: 'EMPTY', reason }
}

export function partial<T>(data: T, missing: string[]): ToolResult<T> {
  return { status: 'PARTIAL', data, missing }
}

export function toolError(error: string): ToolResult<never> {
  return { status: 'ERROR', error }
}

export function unknown(reason: string): ToolResult<never> {
  return { status: 'UNKNOWN', reason }
}

// ─────────────────────────────────────────────────────────────────────────────
// safeQuery — wraps a single Prisma call
//
// Usage:
//   const result = await safeQuery(() => prisma.booking.count({ where: ... }))
//   if (result.status !== 'SUCCESS') return toolError(`bookingCount: ${result.error}`)
//   const count = result.data
// ─────────────────────────────────────────────────────────────────────────────

export async function safeQuery<T>(
  fn: () => Promise<T>,
  label?: string,
): Promise<ToolResult<T>> {
  try {
    const data = await fn()
    return ok(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return toolError(label ? `${label}: ${msg}` : msg)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// safeQueryAll — wraps Promise.all so individual failures are captured
//
// Returns an array of ToolResult<T>, one per query.
// The caller inspects each result independently before using data.
//
// Usage:
//   const [countRes, aggRes] = await safeQueryAll([
//     () => prisma.booking.count(...),
//     () => prisma.walletTransaction.aggregate(...),
//   ])
//   if (countRes.status !== 'SUCCESS') { ... handle error ... }
// ─────────────────────────────────────────────────────────────────────────────

export async function safeQueryAll<T extends readonly (() => Promise<unknown>)[]>(
  fns: T,
  labels?: string[],
): Promise<{ [K in keyof T]: ToolResult<Awaited<ReturnType<T[K]>>> }> {
  const results = await Promise.all(
    fns.map((fn, i) => safeQuery(fn, labels?.[i]))
  )
  return results as { [K in keyof T]: ToolResult<Awaited<ReturnType<T[K]>>> }
}

// ─────────────────────────────────────────────────────────────────────────────
// collectErrors — given a list of ToolResult values, return all that failed
// ─────────────────────────────────────────────────────────────────────────────

export function collectErrors(results: ToolResult<unknown>[]): string[] {
  return results
    .filter(r => r.status === 'ERROR')
    .map(r => (r as { status: 'ERROR'; error: string }).error)
}

// ─────────────────────────────────────────────────────────────────────────────
// hasErrors — quick boolean check
// ─────────────────────────────────────────────────────────────────────────────

export function hasErrors(results: ToolResult<unknown>[]): boolean {
  return results.some(r => r.status === 'ERROR')
}

// ─────────────────────────────────────────────────────────────────────────────
// unwrapOr — extract data or return a fallback VALUE only for EMPTY/UNKNOWN
//
// NOTE: Never use this to silently swallow an ERROR.
// This helper is intentionally restricted: it only accepts EMPTY and UNKNOWN
// as non-fatal statuses. An ERROR result must be handled explicitly.
//
// Usage:
//   const count = unwrapOr(result, 0)  // safe for counts that may be genuinely zero
// ─────────────────────────────────────────────────────────────────────────────

export function unwrapOr<T>(result: ToolResult<T>, fallback: T): T {
  if (result.status === 'SUCCESS' || result.status === 'PARTIAL') {
    return result.data
  }
  if (result.status === 'EMPTY' || result.status === 'UNKNOWN') {
    return fallback
  }
  // result.status === 'ERROR' — caller must not reach here silently
  // Throw to make misuse visible during development/testing
  throw new Error(
    `unwrapOr called on ERROR result — handle errors explicitly. Error: ${
      (result as { status: 'ERROR'; error: string }).error
    }`
  )
}
