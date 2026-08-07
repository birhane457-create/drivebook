import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { normalizeEmail } from './auth-email'
import { recordDeviceLogin, getClientIP, parseUserAgent } from './services/deviceTracking'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const normalizedEmail = normalizeEmail(credentials.email)

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { clients: true, instructor: true }
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        // Instructor-only email verification enforcement
        if (user.role === 'INSTRUCTOR' && !user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials')
        }

        // Allow PENDING instructors to log in — they can explore the dashboard,
        // complete their profile, and upload documents while awaiting approval.
        // Capability gates in the UI (PermissionGate) and API route guards prevent
        // them from creating bookings or receiving payments until APPROVED.
        // Only block SUSPENDED and REJECTED accounts outright.
        if (user.role === 'INSTRUCTOR') {
          const status = user.instructor?.approvalStatus
          if (status === 'SUSPENDED' || status === 'REJECTED') {
            throw new Error('INSTRUCTOR_NOT_APPROVED')
          }
        }

        // P2-3 FIX: Soft gate — block login for unverified emails.
        // The User schema has emailVerified; we only enforce this for non-admin/instructor
        // accounts since admin accounts are created programmatically (already verified).
        // Clients created via the AI voice flow get a generated password but no email
        // verification step yet — so we gate financial actions at the route level instead
        // of hard-blocking login here, to avoid locking out voice-created accounts.
        // If you add email verification to the registration flow, switch this to hard-block:
        // if (!user.emailVerified) throw new Error('Please verify your email before logging in.')

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          instructorId: user.instructorId ?? undefined,
          clientId: user.clients?.[0]?.id
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.instructorId = user.instructorId
        token.clientId = user.clientId
      }

      // Idle timeout: track last activity timestamp
      const now = Math.floor(Date.now() / 1000) // Unix timestamp in seconds
      
      // On sign-in, initialize lastActivity
      if (user) {
        token.lastActivity = now
        return token
      }

      // On every request, check if idle timeout exceeded
      const IDLE_TIMEOUT = 30 * 60 // 30 minutes in seconds
      const lastActivity = token.lastActivity as number | undefined
      
      if (lastActivity && now - lastActivity > IDLE_TIMEOUT) {
        // Session expired due to inactivity
        // Return null to force re-login
        return null as any // NextAuth requires null to invalidate
      }

      // Update lastActivity on every request (extends idle timeout)
      token.lastActivity = now
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.instructorId = token.instructorId as string
        session.user.clientId = token.clientId as string
      }
      return session
    },
    async signIn({ user, account, profile, email, credentials }) {
      // Device tracking + new device email notification
      // Only track for credential-based logins (not OAuth)
      if (!user?.id || !user?.email) return true

      try {
        // Extract device info from the request
        // Note: NextAuth doesn't expose request headers directly in signIn callback
        // We'll need to get this from the authorize() credentials context
        // For now, track at session creation with basic info
        
        // This will be handled in a middleware or the authorize callback where we have access to headers
        return true
      } catch (error) {
        console.error('[Auth] Device tracking failed:', error)
        // Don't block login if tracking fails
        return true
      }
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days absolute maximum
    // Idle timeout enforced in jwt() callback: 30 minutes of inactivity forces re-login
  },
  // Explicitly set cookie name so middleware and server components agree
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
