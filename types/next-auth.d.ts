import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: string
    instructorId?: string
    clientId?: string
  }

  interface Session {
    user: {
      id: string
      email: string
      role: string
      instructorId?: string
      clientId?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    instructorId?: string
    clientId?: string
  }
}
