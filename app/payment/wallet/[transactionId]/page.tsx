'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm({ transactionId, amount }: { transactionId: string; amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/wallet/${transactionId}/confirmation`,
      },
    })
    if (submitError) {
      setError(submitError.message || 'Payment failed')
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {processing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </button>
      <p className="text-xs text-gray-500 text-center">Your payment is secure and encrypted by Stripe</p>
    </form>
  )
}

export default function WalletPaymentPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const transactionId = params.transactionId as string

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pricing details passed via URL params from the wizard
  const hrs = parseFloat(searchParams.get('hrs') || '0')
  const rate = parseFloat(searchParams.get('rate') || '0')
  const discPct = parseFloat(searchParams.get('disc') || '0')
  const total = parseFloat(searchParams.get('total') || '0')
  const addonPrice = parseFloat(searchParams.get('addon') || '0')

  const subtotal = hrs * rate
  const discount = (subtotal * discPct) / 100
  const platformFee = total > 0 ? Math.max(0, total - (subtotal - discount + addonPrice)) : 0

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) throw new Error('Failed to create payment')
        const data = await res.json()
        setClientSecret(data.clientSecret)
        setAmount(data.amount)
      } catch (err: any) {
        setError(err.message || 'Failed to load payment')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [transactionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading payment...</p>
        </div>
      </div>
    )
  }

  if (error || !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Unable to load payment'}</p>
          <button onClick={() => router.push('/')} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Go Home</button>
        </div>
      </div>
    )
  }

  const payAmount = amount || total

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-4">
            <h1 className="text-xl font-bold">Complete Your Package Purchase</h1>
            <p className="text-blue-100 text-sm mt-1">Credits will be added to your wallet after payment</p>
          </div>
          <div className="p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Order Summary */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
                <div className="bg-blue-50 rounded-lg p-4 mb-4 text-sm text-blue-800">
                  💳 After payment, your wallet will be credited with <strong>${payAmount.toFixed(2)}</strong>. Book lessons from your dashboard at any time.
                </div>
                {hrs > 0 && rate > 0 && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>{hrs} hrs × ${rate}/hr</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({discPct}%)</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    {addonPrice > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Add-on package</span>
                        <span>${addonPrice.toFixed(2)}</span>
                      </div>
                    )}
                    {platformFee > 0 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Platform fee</span>
                        <span>${platformFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 border-t pt-2 text-base">
                      <span>Total</span>
                      <span>${payAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Payment Form */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm transactionId={transactionId} amount={payAmount} />
                </Elements>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
