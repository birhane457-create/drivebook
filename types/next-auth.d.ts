import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: string
    /** Generic provider ID — maps to Provider.id (renamed from Instructor in Phase 6). */
    providerId?: string
    customerId?: string
    businessType?: string
    paymentModel?: 'marketplace' | 'saas'
  }

  interface Session {
    user: {
      id: string
      email: string
      role: string
      /** Generic provider ID — maps to Provider.id */
      providerId?: string
      customerId?: string
      businessType?: string
      paymentModel?: 'marketplace' | 'saas'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    /** Generic provider ID — maps to Provider.id */
    providerId?: string
    customerId?: string
    businessType?: string
    paymentModel?: 'marketplace' | 'saas'
  }
}
