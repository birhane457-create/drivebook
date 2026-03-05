import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Main middleware function
export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''
  const url = req.nextUrl.clone()
  
  // Skip middleware for public routes
  const publicPaths = ['/', '/login', '/register', '/instructors', '/auth/forgot-password', '/reset-password', '/api/auth']
  const isPublicPath = publicPaths.some(path => url.pathname === path || url.pathname.startsWith(path))
  
  if (isPublicPath && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    return NextResponse.next()
  }
  
  // Extract subdomain
  const subdomain = extractSubdomain(hostname)
  
  // If subdomain exists and not on a protected route, pass subdomain as header
  // The actual routing will be handled by the page component
  if (subdomain && !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/client-dashboard')) {
    // Check if this is an API route, static file, or already on a booking page
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/_next') || url.pathname.startsWith('/static') || url.pathname.startsWith('/book')) {
      return NextResponse.next()
    }
    
    // If on root path, rewrite to subdomain handler page
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/subdomain'
      const response = NextResponse.rewrite(url)
      response.headers.set('x-subdomain', subdomain)
      return response
    }
  }
  
  // For protected routes, check authentication
  if (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/client-dashboard')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    
    if (!token) {
      // Not authenticated, redirect to login
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', url.pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    // Check role-based access
    const path = url.pathname
    const role = token.role as string
    
    // Admin routes - only for ADMIN and SUPER_ADMIN
    if (path.startsWith('/admin')) {
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/client-dashboard', req.url))
      }
    }

    // Instructor dashboard routes - for INSTRUCTOR, ADMIN, and SUPER_ADMIN only
    if (path.startsWith('/dashboard')) {
      if (role === 'CLIENT') {
        return NextResponse.redirect(new URL('/client-dashboard', req.url))
      }
    }

    // Client dashboard routes - for CLIENT role only
    if (path.startsWith('/client-dashboard')) {
      if (role !== 'CLIENT') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
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
  
  // For production: john.drivebook.com → "john"
  if (parts.length > 2) {
    const subdomain = parts[0]
    // Ignore www
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
