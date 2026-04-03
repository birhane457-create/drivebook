'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function WalletPaymentConfirmation() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const transactionId = params.transactionId as string
  const paymentStatus = searchParams.get('redirect_status')

  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (paymentStatus === 'succeeded') {
      // Verify payment via the verify endpoint
      const paymentIntentId = searchParams.get('payment_intent')
      if (paymentIntentId) {
        fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId, paymentIntentId }),
        }).finally(() => {
          setVerified(true)
          setLoading(false)
        })
      } else {
        setVerified(true)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [paymentStatus, transactionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
          <p className="mt-4 text-gray-600">Confirming your payment...</p>
        </div>
      </div>
    )
  }

  if (paymentStatus !== 'succeeded') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-600 mb-6">Your payment was not completed. No charges were made.</p>
          <button onClick={() => router.back()} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="text-green-500 text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-2">Your wallet has been credited.</p>
        <p className="text-sm text-gray-500 mb-8">
          You can now book lessons from your dashboard at any time.
        </p>
        <div className="space-y-3">
          <Link
            href="/client-dashboard"
            className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Go to Dashboard →
          </Link>
          <Link
            href="/client-dashboard/book-lesson"
            className="block w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium"
          >
            Book a Lesson Now
          </Link>
        </div>
      </div>
    </div>
  )
}
