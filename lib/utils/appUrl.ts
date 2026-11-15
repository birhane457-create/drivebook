/**
 * Returns the canonical application URL for use in Stripe redirect URLs,
 * email links, and any other server-side absolute URL construction.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL  — explicit production override (e.g. https://drivebook.com.au)
 *   2. NEXTAUTH_URL          — NextAuth needs this set anyway; acceptable for auth callbacks
 *   3. http://localhost:3000 — development fallback only
 *
 * NEXT_PUBLIC_APP_URL must be set in Vercel production environment variables.
 * NEXTAUTH_URL should not be used for Stripe redirect URLs because it is
 * set to http://localhost:3000 in local .env files and may carry that value
 * into production if not explicitly overridden in Vercel.
 */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  );
}
