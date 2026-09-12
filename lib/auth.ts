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
          include: { 
            customers: true,
            provider: true,
          }
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        // Instructor-only email verification enforcement
        if (user.role === 'provider' && !user.emailVerified) {
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
        if (user.role === 'provider') {
          const status = user.provider?.approvalStatus
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

        // Load business type and payment model from Provider fields
        let businessType: string | undefined
        let paymentModel: 'marketplace' | 'saas' | undefined

        if (user.provider) {
          // businessModel is set at registration from the business type
          paymentModel = (user.provider?.businessModel as string)?.toLowerCase() === 'marketplace'
            ? 'marketplace'
            : 'saas'
          businessType = paymentModel === 'marketplace' ? 'driving' : 'other'
        } else if (user.providerId) {
          // Legacy: user has providerId but provider not yet loaded
          businessType = 'driving'
          paymentModel = 'marketplace'
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          // DB column is still `providerId` — Phase 1 rename is application-layer only.
          // We expose it as `providerId` in the session so all app code uses the generic name.
          providerId: user.providerId ?? undefined,
          customerId: (user as any).customers?.[0]?.id,
          businessType,
          paymentModel,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.providerId = user.providerId
        token.customerId = user.customerId
        token.businessType = user.businessType
        token.paymentModel = user.paymentModel
      }

      // Backward-compatibility: migrate old tokens that have `providerId` but not `providerId`
      // This handles sessions created before the Phase 1 rename.
      // Can be removed once all active sessions have expired (7 days after deploy).
      if (!token.providerId && (token as any).providerId) {
        token.providerId = (token as any).providerId
      }
      if (!token.customerId && (token as any).customerId) {
        token.customerId = (token as any).customerId
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

      // Only update lastActivity if more than 1 minute has passed since last update
      // This reduces JWT regeneration overhead while still maintaining session security
      const UPDATE_THRESHOLD = 60 // 1 minute
      if (!lastActivity || now - lastActivity > UPDATE_THRESHOLD) {
        token.lastActivity = now
      }
      
      return token
    },
    async session({ session, token }) {
      // token is null when the JWT callback returned null (idle timeout expired).
      // In that case return a session with no user so middleware redirects to /login.
      if (!token) {
        return { ...session, user: undefined as any }
      }
      if (session?.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.providerId = token.providerId as string
        session.user.customerId = token.customerId as string
        session.user.businessType = token.businessType as string
        session.user.paymentModel = token.paymentModel as 'marketplace' | 'saas'
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
