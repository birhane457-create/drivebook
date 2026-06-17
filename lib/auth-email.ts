/**
 * Normalize email for consistent lookups and storage across auth endpoints.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
