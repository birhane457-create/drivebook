import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Main middleware function
export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''
  const url = req.nextUrl.clone()

  // Extract subdomain FIRST — before any public path short-circuits
  const subdomain = extractSubdomain(hostname)

  // If subdomain exists, rewrite to /subdomain/[slug] (skip API/_next/static)
  if (subdomain && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/static') && !url.pathname.startsWith('/booking') && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/register')) {
      const rest = url.pathname === '/' ? '' : url.pathname
      url.pathname = `/subdomain/${subdomain}${rest}`
      const response = NextResponse.rewrite(url)
      response.headers.set('x-subdomain', subdomain)
      return response
    }
    return NextResponse.next()
  }

  // Skip middleware for public routes (non-subdomain)
  const publicPaths = ['/', '/login', '/register', '/instructors', '/auth/forgot-password', '/reset-password', '/api/auth']
  const isPublicPath = publicPaths.some(path => url.pathname === path || url.pathname.startsWith(path))

  if (isPublicPath && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    return NextResponse.next()
  }
  
  // For protected routes, check authentication only — layouts handle role-based access
  if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/client-dashboard')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    
    if (!token) {
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
