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
  const isOwnDomain = hostname.includes('drivebook.com.au') || hostname.includes('localhost') || hostname.includes('vercel.app')
  if (!isOwnDomain) {
    const skipPaths = ['/api', '/_next', '/static', '/booking', '/login', '/register', '/dashboard', '/admin', '/client-dashboard']
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
  const subdomain = extractSubdomain(hostname)

  // If subdomain exists, rewrite to /subdomain/[slug] (skip API/_next/static)
  if (subdomain && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/static') && !url.pathname.startsWith('/booking') && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/register') && !url.pathname.startsWith('/book/') && url.pathname !== '/book') {
      const rest = url.pathname === '/' ? '' : url.pathname
      url.pathname = `/subdomain/${subdomain}${rest}`
      const response = NextResponse.rewrite(url)
      response.headers.set('x-subdomain', subdomain)
      return response
    }
    return NextResponse.next()
  }

  // Skip middleware for public routes (non-subdomain)
  const publicPaths = ['/', '/login', '/register', '/instructors', '/auth/forgot-password', '/reset-password', '/set-password', '/api/auth', '/about', '/contact', '/blog', '/privacy', '/terms', '/teach-with-drivebook', '/book', '/maintenance']
  const isPublicPath = publicPaths.some(path => url.pathname === path || url.pathname.startsWith(path))

  if (isPublicPath && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    return NextResponse.next()
  }
  
  // P0-7 FIX: Protect admin and instructor API routes at the edge.
  // Individual API handlers still call getServerSession(), but this provides
  // defence-in-depth: a missing session check in a new route cannot leak data.
  const isProtectedApiPath =
    url.pathname.startsWith('/api/admin/') ||
    url.pathname.startsWith('/api/instructor/') ||
    url.pathname.startsWith('/api/client/') ||
    url.pathname.startsWith('/api/bookings/')

  // For protected routes, check authentication only — layouts handle role-based access
  if (
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/client-dashboard') ||
    isProtectedApiPath
  ) {
    // On production (https), NextAuth uses __Secure- prefixed cookie name
    const isSecure = req.headers.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production'
    const cookieName = isSecure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName })
    
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
