import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Main middleware function
export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''
  const url = req.nextUrl.clone()

  // ── MAINTENANCE MODE ──────────────────────────────────────────────────────
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  // No fallback — if key is not set, bypass is disabled entirely
  const bypassKey = process.env.MAINTENANCE_BYPASS_KEY ?? null

  if (maintenanceMode) {
    const isMaintenancePage = url.pathname === '/maintenance'
    const isApi = url.pathname.startsWith('/api')
    const isStatic = url.pathname.startsWith('/_next') || url.pathname.startsWith('/static')

    // Allow bypass via query param only if bypassKey is configured
    if (bypassKey && url.searchParams.get('bypass') === bypassKey) {
      const res = NextResponse.redirect(new URL(url.pathname, req.url))
      res.cookies.set('maintenance_bypass', bypassKey, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 })
      return res
    }

    // Allow if bypass cookie is set and matches configured key
    const bypassCookie = req.cookies.get('maintenance_bypass')?.value
    const hasBypass = bypassKey !== null && bypassCookie === bypassKey

    if (!hasBypass && !isMaintenancePage && !isApi && !isStatic) {
      return NextResponse.redirect(new URL('/maintenance', req.url))
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── CUSTOM DOMAIN (Studio tier) ──────────────────────────────────────────
  // If the host is not our own domain, treat it as a custom domain booking page
  const isOwnDomain = 
    hostname.includes(process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au') || 
    hostname.includes('localhost') || 
    hostname.endsWith('vercel.app')  // all *.vercel.app preview/production URLs
  if (!isOwnDomain) {
    const skipPaths = ['/api', '/_next', '/static', '/booking', '/login', '/register', '/dashboard', '/admin', '/client-dashboard', '/sitemap.xml', '/robots.txt', '/rss.xml']
    const shouldRewrite = !skipPaths.some(p => url.pathname.startsWith(p))
    if (shouldRewrite) {
      const rest = url.pathname === '/' ? '' : url.pathname
      url.pathname = `/custom-domain${rest}`
      const response = NextResponse.rewrite(url)
      response.headers.set('x-custom-domain', hostname.split(':')[0])
      return response
    }
    return NextResponse.next()
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Extract subdomain FIRST — before any public path short-circuits
  // Do NOT extract subdomains from vercel.app preview URLs — the full hostname
  // is not a customer subdomain (e.g. drivebook2-abc123-drivebook.vercel.app)
  const isVercelPreview = hostname.endsWith('vercel.app')
  const subdomain = isVercelPreview ? null : extractSubdomain(hostname)

  // If subdomain exists, rewrite to /subdomain/[slug] (skip API/_next/static)
  if (subdomain && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/static') && !url.pathname.startsWith('/booking') && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/register') && !url.pathname.startsWith('/book/') && url.pathname !== '/book' && url.pathname !== '/sitemap.xml' && url.pathname !== '/robots.txt' && url.pathname !== '/rss.xml') {
      const rest = url.pathname === '/' ? '' : url.pathname
      url.pathname = `/subdomain/${subdomain}${rest}`
      const response = NextResponse.rewrite(url)
      response.headers.set('x-subdomain', subdomain)
      return response
    }
    return NextResponse.next()
  }

  // Skip middleware for public routes (non-subdomain)
  const isPublicPath = isPublicMiddlewarePath(url.pathname)

  // P0-7/S-7: classify all protected path types before any early return.
  const isProtectedApiPath =
    url.pathname.startsWith('/api/admin/') ||
    url.pathname.startsWith('/api/instructor/') ||
    url.pathname.startsWith('/api/client/') ||
    url.pathname.startsWith('/api/bookings/')

  // S-7 FIX: /api/auth/* routes not on the explicit NextAuth whitelist must
  // require authentication. Without this gate they fall through to
  // NextResponse.next() because they are neither public nor in isProtectedApiPath.
  const isUnknownAuthApiPath =
    url.pathname.startsWith('/api/auth/') && !isPublicPath

  // Public short-circuit — only when the path is public AND not overridden by
  // a protected classifier above.
  if (
    isPublicPath &&
    !isProtectedApiPath &&
    !isUnknownAuthApiPath &&
    !url.pathname.startsWith('/dashboard') &&
    !url.pathname.startsWith('/admin') &&
    !url.pathname.startsWith('/client-dashboard')
  ) {
    return NextResponse.next()
  }

  // For protected routes, check authentication only — layouts handle role-based access
  if (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/client-dashboard') ||
    url.pathname.startsWith('/business-setup') ||
    url.pathname.startsWith('/onboarding') ||
    url.pathname.startsWith('/staff') ||
    isProtectedApiPath ||
    isUnknownAuthApiPath
  ) {
    // On production (https), NextAuth uses __Secure- prefixed cookie name.
    // Pass both names so getToken() can find the cookie regardless of environment.
    const isSecure = req.headers.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production'
    const cookieName = isSecure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'

    // Try primary cookie name first, fall back to alternate
    let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName })
    if (!token) {
      const altCookieName = isSecure
        ? 'next-auth.session-token'
        : '__Secure-next-auth.session-token'
      token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: altCookieName })
    }
    
    if (!token) {
      // API routes: return 401 JSON — redirect would break fetch() callers
      if (url.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', url.pathname)
      return NextResponse.redirect(loginUrl)
    }
    // Token exists — let the layout handle role-based access control
  }
  
  return NextResponse.next()
}

export function isPublicMiddlewarePath(pathname: string): boolean {
  // '/' is exact-only — it must never act as a prefix for every request.
  if (pathname === '/') return true

  const publicPrefixes = [
    '/login',
    '/register',
    '/instructors',
    '/auth/forgot-password',
    '/reset-password',
    '/set-password',
    '/about',
    '/contact',
    '/blog',
    '/privacy',
    '/terms',
    '/teach-with-drivebook',
    '/book',
    '/maintenance',
    '/learn-to-drive',
    '/pda-guide',
    '/for-instructors',
    '/platform',
    '/features',
    '/compare',
  ]

  if (publicPrefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return true
  }

  // Static files
  if (
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/rss.xml'
  ) {
    return true
  }

  return isNextAuthPublicPath(pathname)
}

// Only these exact NextAuth endpoints are intentionally public.
// This prevents arbitrary future /api/auth/* routes from inheriting
// the public exemption.
//
// Rules:
//   - All endpoints except `callback` are matched exactly (no sub-paths).
//   - `callback` allows exactly one provider segment: /api/auth/callback/:provider
//     but NOT /api/auth/callback/:provider/anything
//
// Correct:  /api/auth/signin
//           /api/auth/callback/google
// Rejected: /api/auth/signin/anything
//           /api/auth/callback/google/extra
//           /api/auth/admin
function isNextAuthPublicPath(pathname: string): boolean {
  // Bare base path
  if (pathname === '/api/auth') return true

  // Exact-match endpoints (no sub-path allowed)
  const exactEndpoints = [
    '/api/auth/signin',
    '/api/auth/signout',
    '/api/auth/session',
    '/api/auth/csrf',
    '/api/auth/providers',
    '/api/auth/verify-request',
    '/api/auth/error',
  ]
  if (exactEndpoints.includes(pathname)) return true

  // callback: /api/auth/callback/:provider — exactly one non-empty provider segment, nothing after
  if (/^\/api\/auth\/callback\/[^/]+$/.test(pathname)) return true

  return false
}

// Extract subdomain from hostname
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]
  
  // Split by dots
  const parts = host.split('.')
  
  // For localhost: john.localhost → "john"
  if (host.includes('localhost')) {
    if (parts.length > 1 && parts[0] !== 'localhost') {
      return parts[0]
    }
    return null
  }
  
  // Known two-part TLDs (e.g. com.au, co.uk, co.nz, org.au)
  const twoPartTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
  const tld2 = parts.slice(-2).join('.')
  const isCompoundTLD = twoPartTLDs.includes(tld2)

  // For compound TLD: need 4+ parts for a subdomain (sub.domain.com.au)
  // For simple TLD: need 3+ parts (sub.domain.com)
  const minParts = isCompoundTLD ? 4 : 3

  if (parts.length >= minParts) {
    const subdomain = parts[0]
    if (subdomain === 'www') {
      return null
    }
    return subdomain
  }

  return null
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
}
