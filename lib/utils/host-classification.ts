/**
 * lib/utils/host-classification.ts
 *
 * Shared hostname classification for WLA-011 fix.
 *
 * Replaces unsafe substring matching (hostname.includes('drivebook.com.au'))
 * with exact hostname-boundary matching in both middleware.ts and
 * app/custom-domain/page.tsx.
 *
 * Classification table (WLA-011):
 *   drivebook.com.au              → own domain
 *   www.drivebook.com.au          → own domain (subdomain)
 *   evil-drivebook.com.au         → custom domain (no dot boundary)
 *   drivebook.com.au.evil.com     → custom domain (root is substring, not suffix)
 *   localhost                     → localhost
 *   john.localhost                → localhost subdomain
 *   localhost.evil.com            → custom domain (no dot boundary)
 *   evil-localhost.com            → custom domain
 *   drivebook-preview.vercel.app  → vercel preview
 *   evil-vercel.app               → custom domain (no dot boundary)
 *   vercel.app                    → vercel platform domain
 *
 * IMPORTANT: Classifying a host as a custom domain does NOT make it an
 * authorised tenant. The database lookup in the custom-domain page must
 * still require a verified domain record.
 */

/**
 * Normalize a hostname: lowercase, strip port, strip trailing dot.
 *
 *   "Example.COM.:443"   → "example.com"
 *   "DRIVEBOOK.COM.AU"   → "drivebook.com.au"
 *   "localhost:3000"     → "localhost"
 *   "[::1]:3000"         → "::1"  (IPv6 in brackets)
 */
export function normalizeHostname(raw: string): string {
  let h = raw.toLowerCase().trim();

  // Strip port — IPv6 addresses in Host headers are wrapped in brackets
  if (h.startsWith('[')) {
    const bracketEnd = h.indexOf(']');
    if (bracketEnd !== -1) {
      h = h.substring(1, bracketEnd);
    }
  } else {
    const colonIdx = h.indexOf(':');
    if (colonIdx !== -1) {
      h = h.substring(0, colonIdx);
    }
  }

  // Strip trailing dot (DNS root label)
  if (h.endsWith('.')) {
    h = h.slice(0, -1);
  }

  return h;
}

/**
 * Check if a hostname is the root domain or a subdomain of it.
 * Uses exact boundary matching — not substring matching.
 *
 *   "drivebook.com.au"            → true  (exact match)
 *   "www.drivebook.com.au"        → true  (subdomain via dot boundary)
 *   "evil-drivebook.com.au"       → false (no dot before root domain)
 *   "drivebook.com.au.evil.com"   → false (root is substring, not suffix)
 */
export function isRootDomainOrSubdomain(hostname: string, rootDomain: string): boolean {
  const h = normalizeHostname(hostname);
  const root = normalizeHostname(rootDomain);
  if (!h || !root) return false;
  return h === root || h.endsWith('.' + root);
}

/**
 * Check if a hostname is localhost or a .localhost subdomain.
 *
 *   "localhost"          → true
 *   "john.localhost"     → true
 *   "localhost.evil.com" → false
 *   "evil-localhost.com" → false
 */
export function isLocalhost(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  return h === 'localhost' || h.endsWith('.localhost');
}

/**
 * Check if a hostname is vercel.app or a *.vercel.app subdomain.
 *
 *   "drivebook-preview.vercel.app" → true
 *   "vercel.app"                   → true
 *   "evil-vercel.app"              → false (no dot boundary)
 */
export function isVercelDomain(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  return h === 'vercel.app' || h.endsWith('.vercel.app');
}

/**
 * Classify a hostname as "own domain" (platform, localhost, vercel) or
 * custom domain. This is the shared classification used by both
 * middleware.ts and app/custom-domain/page.tsx.
 *
 * Returns true if the host is platform/localhost/vercel (NOT a custom domain).
 * Returns false if the host is a custom domain (should be rewritten to
 * /custom-domain by middleware).
 */
export function isOwnDomain(hostname: string, rootDomain: string): boolean {
  return (
    isRootDomainOrSubdomain(hostname, rootDomain) ||
    isLocalhost(hostname) ||
    isVercelDomain(hostname)
  );
}
