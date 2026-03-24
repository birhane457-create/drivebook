'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid email or password')
        setLoading(false)
      } else if (result?.ok) {
        // Successful login - fetch session and redirect
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()
        
        if (session?.user?.role) {
          const role = session.user.role

          // If on a subdomain, redirect to the main domain so dashboards work correctly
          const hostname = window.location.hostname
          // Known compound TLDs — need 4+ parts to be a subdomain (sub.domain.com.au)
          const compoundTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
          const tld2 = hostname.split('.').slice(-2).join('.')
          const minParts = compoundTLDs.includes(tld2) ? 4 : 3
          const isSubdomain = hostname.split('.').length >= minParts && !hostname.startsWith('www.')
          const mainDomain = isSubdomain
            ? window.location.origin.replace(/^https?:\/\/[^.]+\./, 'https://')
            : ''

          if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
            window.location.href = `${mainDomain}/admin`
          } else if (role === 'INSTRUCTOR') {
            window.location.href = `${mainDomain}/dashboard`
          } else if (role === 'CLIENT') {
            window.location.href = `${mainDomain}/client-dashboard`
          } else {
            window.location.href = `${mainDomain}/dashboard`
          }
        } else {
          setError('Session error. Please try again.')
          setLoading(false)
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">Login</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Password</label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              name="password"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm sm:text-base text-gray-600">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
