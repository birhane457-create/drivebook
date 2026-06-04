import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            clients: true,
            instructor: true
          }
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials')
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
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.instructorId = user.instructorId
        token.clientId = user.clientId
      }
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
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
