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

// ── Subdomain extraction ──────────────────────────────────────────────────

/**
 * Known two-part TLDs where a "subdomain" requires an extra label.
 * For com.au: need 4+ parts (sub.domain.com.au)
 * For simple TLD: need 3+ parts (sub.domain.com)
 */
const TWO_PART_TLDS = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au'];

/**
 * Extract the subdomain label from a hostname.
 * Returns null for bare domains, www, localhost without subdomain,
 * and hosts that are too short to have a subdomain.
 *
 *   "john.drivebook.com.au"  → "john"
 *   "john.drivebook.com"     → "john"
 *   "john.localhost"         → "john"
 *   "drivebook.com.au"       → null (bare domain)
 *   "www.drivebook.com.au"   → null (www filtered)
 *   "localhost"              → null (no subdomain)
 *   "evil-vercel.app"        → null (only 2 parts, no compound TLD)
 */
export function extractSubdomain(hostname: string): string | null {
  const host = normalizeHostname(hostname);
  const parts = host.split('.');

  // For localhost: john.localhost → "john"
  if (isLocalhost(host)) {
    if (host === 'localhost') return null;
    const sub = parts[0];
    return sub || null;
  }

  // Known two-part TLDs (e.g. com.au, co.uk, co.nz, org.au)
  const tld2 = parts.slice(-2).join('.');
  const isCompoundTLD = TWO_PART_TLDS.includes(tld2);

  // For compound TLD: need 4+ parts for a subdomain (sub.domain.com.au)
  // For simple TLD: need 3+ parts (sub.domain.com)
  const minParts = isCompoundTLD ? 4 : 3;

  if (parts.length >= minParts) {
    const subdomain = parts[0];
    if (subdomain === 'www') {
      return null;
    }
    return subdomain;
  }

  return null;
}

/**
 * Simulate the middleware's subdomain-extraction decision.
 * This mirrors the middleware logic: if the host is a Vercel preview,
 * skip subdomain extraction (return null). Otherwise, extract the subdomain.
 *
 * Used by regression tests to verify the actual routing decision
 * without needing to invoke the full Next.js middleware function.
 *
 *   "drivebook-preview.vercel.app" → null (Vercel preview — skip extraction)
 *   "evil-vercel.app"             → null (not Vercel — extract → 2 parts → null)
 *   "john.drivebook.com.au"       → "john" (not Vercel — extract → 4 parts → "john")
 */
export function middlewareSubdomainDecision(hostname: string, rootDomain: string): string | null {
  const h = normalizeHostname(hostname);
  // WLA-011 FIX: use shared isVercelDomain (was: hostname.endsWith('vercel.app'))
  if (isVercelDomain(h)) {
    return null;
  }
  return extractSubdomain(h);
}
