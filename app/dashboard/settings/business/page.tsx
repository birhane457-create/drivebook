'use client'
import { DashboardPageLayout } from '@/components/ui'

import { useState, useEffect } from 'react'
import { Save, Type, Zap, CheckCircle, AlertCircle, Info, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BusinessConfig {
  terminology: {
    provider: string
    providers: string
    customer: string
    customers: string
    booking: string
    bookings: string
    service: string
    services: string
    providerGroup: string
  }
  capabilities: {
    onlineBooking: boolean
    onlinePayments: boolean
    quotes: boolean
    packages: boolean
    waitingList: boolean
    reviews: boolean
    aiReceptionist: boolean
    voiceLine: boolean
    mobileApp: boolean
    googleCalendar: boolean
    documentVerification: boolean
    travelTime: boolean
    assessmentTracking: boolean
    websiteBuilder: boolean
    wallet: boolean
    payouts: boolean
    commission: boolean
  }
}

export default function BusinessSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [paymentModel, setPaymentModel] = useState<'marketplace' | 'saas' | null>(null)

  const [config, setConfig] = useState<BusinessConfig>({
    terminology: {
      provider: 'Provider',
      providers: 'Providers',
      customer: 'Customer',
      customers: 'Customers',
      booking: 'Booking',
      bookings: 'Bookings',
      service: 'Service',
      services: 'Services',
      providerGroup: 'Business',
    },
    capabilities: {
      onlineBooking: true,
      onlinePayments: true,
      quotes: false,
      packages: true,
      waitingList: false,
      reviews: true,
      aiReceptionist: false,
      voiceLine: false,
      mobileApp: false,
      googleCalendar: true,
      documentVerification: false,
      travelTime: false,
      assessmentTracking: false,
      websiteBuilder: true,
      wallet: false,
      payouts: false,
      commission: false,
    },
  })

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/business/config')
        if (res.ok) {
          const data = await res.json()
          setConfig(data.config)
          setPaymentModel(data.paymentModel)
        }
      } catch (error) {
        console.error('Failed to fetch business config:', error)
        showToast('error', 'Failed to load configuration')
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
  }, [])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const handleTerminologyChange = (field: keyof BusinessConfig['terminology'], value: string) => {
    setConfig(prev => ({
      ...prev,
      terminology: {
        ...prev.terminology,
        [field]: value,
      },
    }))
  }

  const handleCapabilityToggle = (capability: keyof BusinessConfig['capabilities']) => {
    // Prevent toggling payment model capabilities
    if (['wallet', 'payouts', 'commission'].includes(capability)) {
      showToast('error', `${capability} is controlled by your payment model and cannot be changed individually`)
      return
    }

    setConfig(prev => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [capability]: !prev.capabilities[capability],
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate terminology fields are not empty
    const emptyFields = Object.entries(config.terminology).filter(([_, value]) => !value.trim())
    if (emptyFields.length > 0) {
      showToast('error', 'All terminology fields must be filled')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/business/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!res.ok) {
        const error = await res.json()
        showToast('error', error.error || 'Failed to save configuration')
        return
      }

      showToast('success', 'Business configuration saved successfully! Refreshing...')
      
      // Refresh the page to update session/context
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (error) {
      console.error('Failed to save config:', error)
      showToast('error', 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 text-center">
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Business Configuration</h1>
        <p className="text-muted-foreground">
          Customize terminology and enable/disable platform capabilities to match your business model.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-foreground text-sm font-medium
            ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-destructive'}`}
        >
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Terminology Section */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground mb-1">
                <Type className="h-5 w-5" />
                Terminology
              </h2>
              <p className="text-sm text-muted-foreground">
                Customize how the platform refers to your staff, customers, and services.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider terminology */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Staff Member (Singular)
                <span className="ml-1 text-xs text-muted-foreground/60">e.g., Instructor, Therapist, Technician</span>
              </label>
              <input
                type="text"
                value={config.terminology.provider}
                onChange={(e) => handleTerminologyChange('provider', e.target.value)}
                placeholder="Provider"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Staff Members (Plural)
              </label>
              <input
                type="text"
                value={config.terminology.providers}
                onChange={(e) => handleTerminologyChange('providers', e.target.value)}
                placeholder="Providers"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Customer terminology */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Customer (Singular)
                <span className="ml-1 text-xs text-muted-foreground/60">e.g., Learner, Client, Patient</span>
              </label>
              <input
                type="text"
                value={config.terminology.customer}
                onChange={(e) => handleTerminologyChange('customer', e.target.value)}
                placeholder="Customer"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Customers (Plural)
              </label>
              <input
                type="text"
                value={config.terminology.customers}
                onChange={(e) => handleTerminologyChange('customers', e.target.value)}
                placeholder="Customers"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Service terminology */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Service Type (Singular)
                <span className="ml-1 text-xs text-muted-foreground/60">e.g., Lesson, Appointment, Job</span>
              </label>
              <input
                type="text"
                value={config.terminology.service}
                onChange={(e) => handleTerminologyChange('service', e.target.value)}
                placeholder="Service"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Service Types (Plural)
              </label>
              <input
                type="text"
                value={config.terminology.services}
                onChange={(e) => handleTerminologyChange('services', e.target.value)}
                placeholder="Services"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Booking terminology */}
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Booking (Singular)
                <span className="ml-1 text-xs text-muted-foreground/60">e.g., Lesson, Session, Appointment</span>
              </label>
              <input
                type="text"
                value={config.terminology.booking}
                onChange={(e) => handleTerminologyChange('booking', e.target.value)}
                placeholder="Booking"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Bookings (Plural)
              </label>
              <input
                type="text"
                value={config.terminology.bookings}
                onChange={(e) => handleTerminologyChange('bookings', e.target.value)}
                placeholder="Bookings"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Business group terminology */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2 text-foreground">
                Business Group Name
                <span className="ml-1 text-xs text-muted-foreground/60">e.g., Driving School, Studio, Practice</span>
              </label>
              <input
                type="text"
                value={config.terminology.providerGroup}
                onChange={(e) => handleTerminologyChange('providerGroup', e.target.value)}
                placeholder="PREMIUM"
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="mt-4 bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 text-sm text-primary">
            <p className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                These labels appear throughout the platform — in dashboards, emails, and customer-facing pages.
                Changes take effect immediately after saving.
              </span>
            </p>
          </div>
        </div>

        {/* Capabilities Section */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground mb-1">
                <Zap className="h-5 w-5" />
                Platform Capabilities
              </h2>
              <p className="text-sm text-muted-foreground">
                Enable or disable features based on your business model.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Booking & Discovery */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Booking & Discovery</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CapabilityToggle
                  label="Online Booking"
                  description="Customers can book appointments online"
                  enabled={config.capabilities.onlineBooking}
                  onChange={() => handleCapabilityToggle('onlineBooking')}
                />
                <CapabilityToggle
                  label="Online Payments"
                  description="Accept payments through the platform"
                  enabled={config.capabilities.onlinePayments}
                  onChange={() => handleCapabilityToggle('onlinePayments')}
                />
                <CapabilityToggle
                  label="Quote Workflow"
                  description="Request → Quote → Approval workflow"
                  enabled={config.capabilities.quotes}
                  onChange={() => handleCapabilityToggle('quotes')}
                />
                <CapabilityToggle
                  label="Package Deals"
                  description="Bulk booking discounts (e.g., 10-hour packages)"
                  enabled={config.capabilities.packages}
                  onChange={() => handleCapabilityToggle('packages')}
                />
                <CapabilityToggle
                  label="Waiting List"
                  description="Customers can join a waitlist for full slots"
                  enabled={config.capabilities.waitingList}
                  onChange={() => handleCapabilityToggle('waitingList')}
                />
                <CapabilityToggle
                  label="Reviews"
                  description="Customers can leave ratings and reviews"
                  enabled={config.capabilities.reviews}
                  onChange={() => handleCapabilityToggle('reviews')}
                />
              </div>
            </div>

            {/* Communication & AI */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Communication & AI</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CapabilityToggle
                  label="AI Receptionist"
                  description="AI assistant handles booking inquiries"
                  enabled={config.capabilities.aiReceptionist}
                  onChange={() => handleCapabilityToggle('aiReceptionist')}
                />
                <CapabilityToggle
                  label="Voice Line"
                  description="Dedicated phone number with AI answering"
                  enabled={config.capabilities.voiceLine}
                  onChange={() => handleCapabilityToggle('voiceLine')}
                />
                <CapabilityToggle
                  label="Mobile App"
                  description="Native mobile app for staff and customers"
                  enabled={config.capabilities.mobileApp}
                  onChange={() => handleCapabilityToggle('mobileApp')}
                />
                <CapabilityToggle
                  label="Google Calendar Sync"
                  description="Two-way sync with Google Calendar"
                  enabled={config.capabilities.googleCalendar}
                  onChange={() => handleCapabilityToggle('googleCalendar')}
                />
              </div>
            </div>

            {/* Compliance & Operations */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Compliance & Operations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CapabilityToggle
                  label="Document Verification"
                  description="Upload and verify compliance documents"
                  enabled={config.capabilities.documentVerification}
                  onChange={() => handleCapabilityToggle('documentVerification')}
                />
                <CapabilityToggle
                  label="Travel Time"
                  description="Staff travel to customer location"
                  enabled={config.capabilities.travelTime}
                  onChange={() => handleCapabilityToggle('travelTime')}
                />
                <CapabilityToggle
                  label="Assessment Tracking"
                  description="Progress tracking with outcome codes"
                  enabled={config.capabilities.assessmentTracking}
                  onChange={() => handleCapabilityToggle('assessmentTracking')}
                />
                <CapabilityToggle
                  label="Website Builder"
                  description="Custom website for your business"
                  enabled={config.capabilities.websiteBuilder}
                  onChange={() => handleCapabilityToggle('websiteBuilder')}
                />
              </div>
            </div>

            {/* Payment Model Capabilities */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Payment Model Capabilities
                <span className="ml-2 text-xs font-normal text-muted-foreground/60">
                  (Controlled by payment model: {paymentModel === 'marketplace' ? 'Marketplace' : 'SaaS'})
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CapabilityToggle
                  label="Customer Wallet"
                  description="Prepaid credit balance for customers"
                  enabled={config.capabilities.wallet}
                  onChange={() => handleCapabilityToggle('wallet')}
                  disabled={true}
                  tooltip="Controlled by payment model"
                />
                <CapabilityToggle
                  label="Provider Payouts"
                  description="Platform pays providers via Stripe Connect"
                  enabled={config.capabilities.payouts}
                  onChange={() => handleCapabilityToggle('payouts')}
                  disabled={true}
                  tooltip="Controlled by payment model"
                />
                <CapabilityToggle
                  label="Platform Commission"
                  description="Platform takes commission per transaction"
                  enabled={config.capabilities.commission}
                  onChange={() => handleCapabilityToggle('commission')}
                  disabled={true}
                  tooltip="Controlled by payment model"
                />
              </div>
              <div className="mt-3 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
                <p className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    These capabilities are determined by your payment model and cannot be changed individually.
                    Contact support to change your payment model.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between bg-card rounded-2xl shadow-sm border border-border p-6">
          <p className="text-sm text-muted-foreground">
            Changes take effect immediately and update your dashboard terminology.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-secondary/70 disabled:cursor-not-allowed text-foreground rounded-xl font-medium transition-colors"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

interface CapabilityToggleProps {
  label: string
  description: string
  enabled: boolean
  onChange: () => void
  disabled?: boolean
  tooltip?: string
}

function CapabilityToggle({ label, description, enabled, onChange, disabled, tooltip }: CapabilityToggleProps) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border ${
        enabled
          ? 'bg-blue-900/20 border-blue-700/40'
          : 'bg-secondary/50 border-border/50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-600/50'} transition-colors`}
      onClick={disabled ? undefined : onChange}
      title={tooltip}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
            enabled
              ? 'bg-primary border-blue-600'
              : 'bg-card border-border'
          }`}
        >
          {enabled && <CheckCircle className="h-4 w-4 text-foreground" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground flex items-center gap-2">
          {label}
          {disabled && (
            <span className="text-xs text-muted-foreground/60 bg-secondary px-2 py-0.5 rounded">
              Locked
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
    </div>
  )
}
