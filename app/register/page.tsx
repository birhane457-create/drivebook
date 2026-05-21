'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [instructorTermsAccepted, setInstructorTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!instructorTermsAccepted || !privacyAccepted) {
      setError('You must accept the Instructor Terms and Privacy Policy to register.')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
          name: formData.get('name'),
          phone: formData.get('phone'),
          baseAddress: formData.get('baseAddress'),
          baseLatitude: -33.8688,
          baseLongitude: 151.2093,
          hourlyRate: Number(formData.get('hourlyRate')),
          vehicleTypes: [formData.get('vehicleType')],
          serviceRadiusKm: Number(formData.get('serviceRadius')),
          termsAccepted: true,
          termsVersion: '1.0',
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.redirectTo) {
          router.push(data.redirectTo)
        } else {
          router.push('/login')
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Register as Instructor</h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

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
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Base Address</label>
            <input
              type="text"
              name="baseAddress"
              required
              placeholder="e.g. Maylands WA 6051"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              name="hourlyRate"
              required
              min="0"
              step="0.01"
              placeholder="65"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Type</label>
            <select
              name="vehicleType"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            >
              <option value="AUTO">Automatic</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Service Radius (km)</label>
            <input
              type="number"
              name="serviceRadius"
              required
              min="5"
              max="100"
              defaultValue="20"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Terms acceptance */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={instructorTermsAccepted}
                onChange={(e) => setInstructorTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded w-4 h-4 text-blue-600"
                required
              />
              <span className="text-sm text-gray-700">
                I have read and agree to the{' '}
                <Link href="/instructor-terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Instructor Terms and Conditions
                </Link>
                . I confirm I am an independent contractor and not an employee of DriveBook.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 rounded w-4 h-4 text-blue-600"
                required
              />
              <span className="text-sm text-gray-700">
                I have read and agree to the{' '}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                  Privacy Policy
                </Link>
                . I consent to DriveBook collecting and using my information as described.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !instructorTermsAccepted || !privacyAccepted}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Instructor Account'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            By registering, you confirm you hold a valid WA driving instructor accreditation and current insurance.
          </p>
        </form>
      </div>
    </div>
  )
}

      if (response.ok) {
        const data = await response.json()
        // Redirect to profile completion if specified
        if (data.redirectTo) {
          router.push(data.redirectTo)
        } else {
          router.push('/login')
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">Register as Instructor</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

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
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Base Address</label>
            <input
              type="text"
              name="baseAddress"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              name="hourlyRate"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Type</label>
            <select
              name="vehicleType"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            >
              <option value="AUTO">Automatic</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Service Radius (km)</label>
            <input
              type="number"
              name="serviceRadius"
              required
              min="5"
              max="100"
              defaultValue="20"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm sm:text-base text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
