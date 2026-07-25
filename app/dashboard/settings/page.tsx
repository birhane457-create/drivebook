'use client'

import { useState, useEffect } from 'react'
import { Save, DollarSign, Clock, MapPin, Plus, X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Zap, Check } from 'lucide-react'
import GoogleCalendarSettings from '@/components/GoogleCalendarSettings'
import VoiceLineDisplay from '@/components/instructor/VoiceLineDisplay'
import SuburbAutocomplete from '@/components/instructor/SuburbAutocomplete'

interface TimeSlot {
  start: string
  end: string
}

interface WorkingHours {
  monday: TimeSlot[]
  tuesday: TimeSlot[]
  wednesday: TimeSlot[]
  thursday: TimeSlot[]
  friday: TimeSlot[]
  saturday: TimeSlot[]
  sunday: TimeSlot[]
}

interface PDAConfig {
  id: string
  name: string
  durationMinutes: number
  price: number
  discountPercent?: number | null
  testCentreIds?: string[]
  includes?: {
    pickup: boolean
    dropoff: boolean
    debriefing: boolean
  }
  notes?: string
  isActive: boolean
}

interface TestCentre {
  id: string
  name: string
  address: string
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [workingHoursExpanded, setWorkingHoursExpanded] = useState(false)
  const [bookingPrefsExpanded, setBookingPrefsExpanded] = useState(false)
  const [pdaConfigsExpanded, setPdaConfigsExpanded] = useState(false)
  const [voiceLineData, setVoiceLineData] = useState<{
    voiceLine: string | null
    voiceLineStatus: 'NONE' | 'ACTIVE' | 'SUSPENDED'
    subscriptionTier: string
  } | null>(null)
  const [expandedPDAConfig, setExpandedPDAConfig] = useState<string | null>(null)
  const [testCentres, setTestCentres] = useState<TestCentre[]>([])
  const [loadingCentres, setLoadingCentres] = useState(true)
  const [originalPDAConfigIds, setOriginalPDAConfigIds] = useState<string[]>([])
  const [formData, setFormData] = useState<{
    hourlyRate: number
    serviceRadiusKm: number
    baseAddress: string
    licenseNumber: string
    insuranceNumber: string
    vehicleTypes: string[]
    workingHours: WorkingHours
    allowedDurations: number[]
    bookingBufferMinutes: number
    enableTravelTime: boolean
    travelTimeMinutes: number
    pdaConfigs: PDAConfig[]
    acceptingBookings: boolean
  }>({
    hourlyRate: 60,
    serviceRadiusKm: 20,
    baseAddress: '',
    licenseNumber: '',
    insuranceNumber: '',
    vehicleTypes: ['AUTO'],
    workingHours: {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [{ start: '09:00', end: '13:00' }],
      sunday: []
    },
    allowedDurations: [60, 120],
    bookingBufferMinutes: 15,
    enableTravelTime: false,
    travelTimeMinutes: 10,
    pdaConfigs: [],
    acceptingBookings: true,
  })

  // Load test centres on mount
  useEffect(() => {
    const fetchTestCentres = async () => {
      try {
        const res = await fetch('/api/test-centres')
        if (res.ok) {
          const data = await res.json()
          const centres = data.testCentres || []
          setTestCentres(centres)
        } else {
          console.error('Failed to fetch test centres:', res.status, res.statusText)
        }
      } catch (error) {
        console.error('Failed to fetch test centres:', error)
      } finally {
        setLoadingCentres(false)
      }
    }
    fetchTestCentres()
  }, [])

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, pdaConfigsRes, voiceLineRes] = await Promise.all([
          fetch('/api/instructor/settings'),
          fetch('/api/instructor/pda-configs'),
          fetch('/api/instructor/voice-line'),
        ])

        // Voice line status
        if (voiceLineRes.ok) {
          const vl = await voiceLineRes.json()
          setVoiceLineData({
            voiceLine: vl.voiceLine,
            voiceLineStatus: vl.voiceLineStatus ?? 'NONE',
            subscriptionTier: vl.subscriptionTier ?? 'BASIC',
          })
        }

        let pdaConfigs: PDAConfig[] = []
        
        if (pdaConfigsRes.ok) {
          const pdaData = await pdaConfigsRes.json()
          const rawConfigs = Array.isArray(pdaData.configs) ? pdaData.configs : []
          
          // Transform raw configs: convert testCentres array to testCentreIds
          pdaConfigs = rawConfigs.map((config: any) => ({
            id: config.id,
            name: config.name,
            durationMinutes: config.durationMinutes,
            price: config.price,
            discountPercent: config.discountPercent,
            testCentreIds: config.testCentres?.map((tc: any) => tc.testCentre.id) || [],
            includes: config.includes,
            notes: config.notes,
            isActive: config.isActive
          }))
          
          // Track original config IDs from DB so we can detect deletions later
          setOriginalPDAConfigIds(pdaConfigs.map(c => c.id))
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json()

          // Normalize workingHours from DB
          const normalizeWorkingHours = (wh: any): WorkingHours => {
            const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
            const defaults: WorkingHours = {
              monday: [{ start: '09:00', end: '17:00' }],
              tuesday: [{ start: '09:00', end: '17:00' }],
              wednesday: [{ start: '09:00', end: '17:00' }],
              thursday: [{ start: '09:00', end: '17:00' }],
              friday: [{ start: '09:00', end: '17:00' }],
              saturday: [{ start: '09:00', end: '13:00' }],
              sunday: [],
            }
            if (!wh || typeof wh !== 'object') return defaults
            const result = { ...defaults }
            for (const day of days) {
              const val = wh[day]
              if (!val) { result[day] = []; continue }
              if (Array.isArray(val)) {
                result[day] = val.filter((s: any) => s && s.start && s.end)
              } else if (typeof val === 'object' && val.start && val.end) {
                result[day] = val.enabled === false ? [] : [{ start: val.start, end: val.end }]
              } else {
                result[day] = []
              }
            }
            return result
          }

          setFormData({
            hourlyRate: data.hourlyRate || 60,
            serviceRadiusKm: data.serviceRadiusKm || 20,
            baseAddress: data.baseAddress || '',
            licenseNumber: data.licenseNumber || '',
            insuranceNumber: data.insuranceNumber || '',
            vehicleTypes: data.vehicleTypes || ['AUTO'],
            workingHours: normalizeWorkingHours(data.workingHours),
            allowedDurations: data.allowedDurations || [60, 120],
            bookingBufferMinutes: data.bookingBufferMinutes || 15,
            enableTravelTime: data.enableTravelTime || false,
            travelTimeMinutes: data.travelTimeMinutes || 10,
            pdaConfigs: pdaConfigs,
            acceptingBookings: data.acceptingBookings !== false,
          })
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const addPDAConfig = () => {
    const newConfig: PDAConfig = {
      id: `pda_${Date.now()}`,
      name: '',
      durationMinutes: 180,
      price: 225,
      discountPercent: null,
      testCentreIds: [],
      includes: {
        pickup: true,
        dropoff: true,
        debriefing: true
      },
      notes: '',
      isActive: true
    }
    // Update form data with new config
    const updatedFormData = {
      ...formData,
      pdaConfigs: [...formData.pdaConfigs, newConfig]
    }
    setFormData(updatedFormData)
    
    // Expand the new config so user can see the form (use setTimeout to ensure state is updated)
    setTimeout(() => {
      setExpandedPDAConfig(newConfig.id)
    }, 0)
  }

  const updatePDAConfig = (id: string, updates: Partial<PDAConfig>) => {
    setFormData(prev => ({
      ...prev,
      pdaConfigs: prev.pdaConfigs.map(config => 
        config.id === id ? { ...config, ...updates } : config
      )
    }))
  }

  const [pdaDeleteConfirmId, setPdaDeleteConfirmId] = useState<string | null>(null)

  const removePDAConfig = (id: string) => {
    // FIX BUG-4: replaced window.confirm() with inline confirmation state
    setPdaDeleteConfirmId(id)
  }

  const confirmRemovePDAConfig = (id: string) => {
    setFormData(prev => ({
      ...prev,
      pdaConfigs: prev.pdaConfigs.filter(config => config.id !== id)
    }))
    setExpandedPDAConfig(null)
    setPdaDeleteConfirmId(null)
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate at least one duration is selected
    if (formData.allowedDurations.length === 0) {
      showToast('error', 'Please select at least one lesson duration')
      return
    }
    
    const settingsData = {
      hourlyRate: formData.hourlyRate,
      serviceRadiusKm: formData.serviceRadiusKm,
      baseAddress: formData.baseAddress || null,
      licenseNumber: formData.licenseNumber || null,
      insuranceNumber: formData.insuranceNumber || null,
      vehicleTypes: formData.vehicleTypes,
      workingHours: formData.workingHours,
      allowedDurations: formData.allowedDurations,
      bookingBufferMinutes: formData.bookingBufferMinutes,
      enableTravelTime: formData.enableTravelTime,
      travelTimeMinutes: formData.travelTimeMinutes,
      acceptingBookings: formData.acceptingBookings,
    }
    
    
    setSaving(true)
    
    try {
      // Save general settings first
      const res = await fetch('/api/instructor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
      })

      if (!res.ok) {
        const error = await res.json()
        console.error('❌ Settings save error:', error)
        showToast('error', `Failed to save: ${error.details || error.error || 'Unknown error'}`)
        setSaving(false)
        return
      }


      // First, detect and DELETE removed configs
      const currentConfigIds = formData.pdaConfigs.map(c => c.id)
      const deletedConfigIds = originalPDAConfigIds.filter(id => !currentConfigIds.includes(id))
      
      
      for (const deletedId of deletedConfigIds) {
        try {
          const deleteRes = await fetch(`/api/instructor/pda-configs/${deletedId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (!deleteRes.ok) {
            const deleteError = await deleteRes.json()
            console.error(`❌ Failed to delete PDA config ${deletedId}:`, deleteError)
            // Don't block - just log and continue
          } else {
          }
        } catch (error) {
          console.error(`Error deleting PDA config ${deletedId}:`, error)
          // Don't block - just log and continue
        }
      }

      // Save only COMPLETED PDA configs (must have name AND test centres)
      let savedCount = 0
      const updatedPdaConfigs: PDAConfig[] = []
      
      for (const config of formData.pdaConfigs) {
        // Skip if no name (empty template)
        if (!config.name || config.name.trim() === '') {
          continue
        }
        
        // Skip if no test centres selected
        if (!config.testCentreIds || config.testCentreIds.length === 0) {
          continue
        }

        const isExistingConfig = originalPDAConfigIds.includes(config.id)
        const url = isExistingConfig
          ? `/api/instructor/pda-configs/${config.id}`
          : '/api/instructor/pda-configs'
        const method = isExistingConfig ? 'PATCH' : 'POST'

        try {
          const pdaRes = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: config.name,
              durationMinutes: config.durationMinutes,
              price: config.price,
              discountPercent: config.discountPercent,
              testCentreIds: config.testCentreIds,
              includes: config.includes,
              notes: config.notes,
              isActive: config.isActive
            })
          })
          
          if (!pdaRes.ok) {
            const pdaError = await pdaRes.json()
            console.error(`❌ Failed to ${isExistingConfig ? 'update' : 'save'} PDA config "${config.name}":`, pdaError)
            // Don't block - just skip this one and continue
            continue
          }
          
          // Get the saved config from response (has real DB ID)
          const savedConfig = await pdaRes.json()
          
          // Transform API response: convert testCentres array to testCentreIds array
          const transformedConfig: PDAConfig = {
            id: savedConfig.id,
            name: savedConfig.name,
            durationMinutes: savedConfig.durationMinutes,
            price: savedConfig.price,
            discountPercent: savedConfig.discountPercent,
            testCentreIds: savedConfig.testCentres?.map((tc: any) => tc.testCentre.id) || [],
            includes: savedConfig.includes,
            notes: savedConfig.notes,
            isActive: savedConfig.isActive
          }
          
          updatedPdaConfigs.push(transformedConfig)
          savedCount++
        } catch (error) {
          console.error(`Error ${isExistingConfig ? 'updating' : 'saving'} PDA config "${config.name}":`, error)
          // Don't block - just skip this one and continue
          continue
        }
      }
      
      // Update form state with actual saved configs (with real DB IDs)
      setFormData(prev => ({
        ...prev,
        pdaConfigs: updatedPdaConfigs
      }))
      
      // Update the tracking list with the new saved configs
      setOriginalPDAConfigIds(updatedPdaConfigs.map(c => c.id))

      // Keep the first saved config expanded so user can see what was saved
      if (updatedPdaConfigs.length > 0) {
        setExpandedPDAConfig(updatedPdaConfigs[0].id)
      }

      // Show success message
      let message = 'Settings saved successfully!'
      if (formData.pdaConfigs.length > 0) {
        const skipped = formData.pdaConfigs.length - savedCount
        if (skipped > 0) {
          message += ` (${savedCount} PDA configs saved${skipped > 0 ? `, ${skipped} incomplete - fill in details to save them` : ''})`
        }
      }
      showToast('success', message)
    } catch (error) {
      console.error('Failed to save settings:', error)
      showToast('error', 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  return (
          <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-slate-100">Settings</h1>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium
            ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.message}
          </div>
        )}

        {loading ? (
          <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6 text-center">
            <p className="text-slate-400">Loading settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Pricing Section */}
            <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-100">
                <DollarSign className="h-5 w-5" />
                Pricing
              </h2>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-200">Hourly Rate ($)</label>
                <input
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) }))}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Service Area Section */}
            <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-100">
                <MapPin className="h-5 w-5" />
                Service Area
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">Service Radius (km)</label>
                  <input
                    type="number"
                    value={formData.serviceRadiusKm}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceRadiusKm: parseInt(e.target.value) }))}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Maximum distance you're willing to travel for pickups</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">Base Address</label>
                  <SuburbAutocomplete
                    value={formData.baseAddress}
                    onChange={(address) => setFormData(prev => ({ ...prev, baseAddress: address }))}
                    placeholder="Search suburb or postcode... e.g. Maylands or 6051"
                  />
                  <p className="text-xs text-slate-400 mt-1">Your home base  suburb name shown publicly, precise address kept private</p>
                </div>
              </div>
            </div>

            {/* Professional Credentials */}
            <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-slate-100">
                <Zap className="h-5 w-5" />
                Professional Credentials
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Stored securely, not shown publicly.{' '}
                <a href="/dashboard/documents" className="text-violet-400 hover:underline">
                  Upload documents (licence, insurance) →
                </a>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">Instructor Licence Number</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                    placeholder="e.g. DI12345"
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-200">Insurance Policy Number</label>
                  <input
                    type="text"
                    value={formData.insuranceNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, insuranceNumber: e.target.value }))}
                    placeholder="e.g. POL-2024-XXXXX"
                    className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(!formData.licenseNumber || !formData.insuranceNumber) && (
                  <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-sm text-amber-300">
                    ⚠️ Complete your credentials — required for approval and student trust.
                  </div>
                )}
              </div>
            </div>

            {/* Booking Preferences Section */}
            <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setBookingPrefsExpanded(!bookingPrefsExpanded)}
              >
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                  <Clock className="h-5 w-5" />
                  Booking Preferences
                </h2>
                {bookingPrefsExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>

              {bookingPrefsExpanded && (
                <div className="space-y-6 mt-4">
                  {/* Allowed Durations */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Lesson Durations You Offer</label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { value: 30, label: '30 min' },
                        { value: 60, label: '1 hour' },
                        { value: 90, label: '1.5 hours' },
                        { value: 120, label: '2 hours' },
                        { value: 180, label: '3 hours' }
                      ].map((duration) => (
                        <label key={duration.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.allowedDurations.includes(duration.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  allowedDurations: [...prev.allowedDurations, duration.value].sort((a, b) => a - b)
                                }))
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  allowedDurations: prev.allowedDurations.filter(d => d !== duration.value)
                                }))
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="text-sm">{duration.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Select at least one duration. Students can only book these lengths.</p>
                    {formData.allowedDurations.length === 0 && (
                      <p className="text-xs text-rose-400 mt-1">⚠️ Please select at least one duration</p>
                    )}
                  </div>

                  {/* Buffer Time */}
                  <div>
                    <label className="block text-sm font-medium mb-3">Buffer Between Bookings</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {[10, 15, 20].map((minutes) => (
                        <label key={minutes} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="bookingBuffer"
                            value={minutes}
                            checked={formData.bookingBufferMinutes === minutes}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              bookingBufferMinutes: parseInt(e.target.value)
                            }))}
                            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="text-sm">{minutes} minutes</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Time for rest, paperwork, and preparation between students (always applied)
                    </p>
                  </div>

                  {/* Travel Time */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={formData.enableTravelTime}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          enableTravelTime: e.target.checked
                        }))}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
                      />
                      <span className="text-sm font-medium">Add travel time between bookings</span>
                    </label>
                    
                    {formData.enableTravelTime && (
                      <div className="ml-6 space-y-2">
                        <div className="flex items-center gap-3">
                          <label className="text-sm">Travel time (minutes):</label>
                          <input
                            type="number"
                            value={formData.travelTimeMinutes}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              travelTimeMinutes: parseInt(e.target.value) || 10
                            }))}
                            min="5"
                            max="60"
                            className="w-20 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-300">minutes</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Additional time on top of buffer for traveling to next student's location
                        </p>
                      </div>
                    )}
                    
                    {!formData.enableTravelTime && (
                      <p className="text-xs text-slate-400 ml-6">
                        Only buffer time will be applied between bookings
                      </p>
                    )}
                  </div>

                  {/* Example Preview */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-100 mb-2">📅 Schedule Example:</h4>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>
                        <strong>Lesson:</strong> 1 hour (9:00-10:00)
                      </p>
                      <p>
                        <strong>Buffer:</strong> {formData.bookingBufferMinutes} minutes (10:00-10:{formData.bookingBufferMinutes.toString().padStart(2, '0')})
                      </p>
                      {formData.enableTravelTime && (
                        <p>
                          <strong>Travel:</strong> {formData.travelTimeMinutes} minutes (10:{formData.bookingBufferMinutes.toString().padStart(2, '0')}-10:{(formData.bookingBufferMinutes + formData.travelTimeMinutes).toString().padStart(2, '0')})
                        </p>
                      )}
                      <p className="pt-2 border-t border-slate-700 mt-2">
                        <strong>Total blocked:</strong> {60 + formData.bookingBufferMinutes + (formData.enableTravelTime ? formData.travelTimeMinutes : 0)} minutes
                      </p>
                      <p>
                        <strong>Next available:</strong> {formData.enableTravelTime 
                          ? `10:${(formData.bookingBufferMinutes + formData.travelTimeMinutes).toString().padStart(2, '0')}`
                          : `10:${formData.bookingBufferMinutes.toString().padStart(2, '0')}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!bookingPrefsExpanded && (
                <p className="text-sm text-slate-400 mt-2">Click to expand and edit booking preferences</p>
              )}
            </div>

            {/* Working Hours Section */}
            <div className="bg-slate-950 rounded-3xl shadow-sm border border-slate-800 p-6">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setWorkingHoursExpanded(!workingHoursExpanded)}
              >
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                  <Clock className="h-5 w-5" />
                  Working Hours
                </h2>
                {workingHoursExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
              
              {workingHoursExpanded && (
                <>
                  <p className="text-sm text-slate-400 mb-4 mt-4">
                    Set your availability for each day. You can add multiple time slots per day (e.g., 8:00-12:00 and 14:00-18:00 for split shifts).
                  </p>
                  
                  <div className="space-y-4">
                    {days.map((day) => (
                      <div key={day} className="border border-slate-700 bg-slate-900 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-medium capitalize">{day}</div>
                          <button
                            type="button"
                            onClick={() => {
                              const newHours = { ...formData.workingHours }
                              const dayKey = day as keyof typeof formData.workingHours
                              newHours[dayKey] = [...(newHours[dayKey] || []), { start: '09:00', end: '17:00' }]
                              setFormData(prev => ({ ...prev, workingHours: newHours }))
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Add Time Slot
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {(formData.workingHours[day as keyof typeof formData.workingHours] || []).length === 0 ? (
                            <div className="text-sm text-slate-400 italic">Not working this day</div>
                          ) : (
                            formData.workingHours[day as keyof typeof formData.workingHours].map((slot, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={slot.start}
                                  onChange={(e) => {
                                    const newHours = { ...formData.workingHours }
                                    const dayKey = day as keyof typeof newHours
                                    newHours[dayKey][index].start = e.target.value
                                    setFormData(prev => ({ ...prev, workingHours: newHours }))
                                  }}
                                  className="flex-1 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-slate-400">to</span>
                                <input
                                  type="time"
                                  value={slot.end}
                                  onChange={(e) => {
                                    const newHours = { ...formData.workingHours }
                                    const dayKey = day as keyof typeof newHours
                                    newHours[dayKey][index].end = e.target.value
                                    setFormData(prev => ({ ...prev, workingHours: newHours }))
                                  }}
                                  className="flex-1 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newHours = { ...formData.workingHours }
                                    const dayKey = day as keyof typeof newHours
                                    newHours[dayKey] = newHours[dayKey].filter((_, i) => i !== index)
                                    setFormData(prev => ({ ...prev, workingHours: newHours }))
                                  }}
                                  className="text-red-400 hover:text-red-500 p-2"
                                  title="Remove time slot"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              
              {!workingHoursExpanded && (
                <p className="text-sm text-slate-400 mt-2">Click to expand and edit your working hours</p>
              )}
            </div>

            {/* PDA Test Configurations Section */}
            <div className="bg-slate-950 rounded-3xl shadow-sm border border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <h2 
                  className="text-xl font-bold flex items-center gap-2 text-slate-100 flex-1 cursor-pointer"
                  onClick={() => setPdaConfigsExpanded(!pdaConfigsExpanded)}
                >
                  <Zap className="h-5 w-5 text-amber-500" />
                  PDA Test Configurations
                </h2>
                <div className="flex items-center gap-2">
                  {pdaConfigsExpanded && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        addPDAConfig()
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add PDA Config
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPdaConfigsExpanded(!pdaConfigsExpanded)}
                    className="text-slate-400 hover:text-slate-300 p-1"
                  >
                    {pdaConfigsExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {pdaConfigsExpanded && (
                <>
                  <p className="text-sm text-slate-400 mb-4 mt-4">
                    Configure PDA (Practical Driving Assessment) test packages. Each config specifies duration, price, test centres, and what's included.
                  </p>
                  
                  {formData.pdaConfigs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Zap className="h-12 w-12 mx-auto mb-2 opacity-50 text-amber-500" />
                      <p>No PDA configurations yet</p>
                      <p className="text-sm">Create PDA test packages to offer students</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.pdaConfigs.map((config) => {
                        const isExpanded = expandedPDAConfig === config.id
                        const durationStr = `${Math.floor(config.durationMinutes / 60)}h ${config.durationMinutes % 60}m`
                        const selectedCentresPreview = config.testCentreIds?.slice(0, 3).map(id => testCentres.find(c => c.id === id)?.name).filter(Boolean) || []
                        const moreCount = (config.testCentreIds?.length || 0) - 3
                        
                        // Only show in collapsed view if it has a name (is complete)
                        const isComplete = config.name && config.name.trim() !== ''
                        
                        return (
                          <div key={config.id}>
                            {/* COLLAPSED VIEW - show ALL configs (complete or incomplete) */}
                            {!isExpanded && (
                              <div className="border border-slate-700 bg-slate-900 rounded-lg p-3 flex items-center justify-between hover:bg-slate-800/50 transition">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-4 flex-wrap">
                                    {isComplete ? (
                                      <>
                                        <span className="text-sm font-medium text-slate-100">{config.name}</span>
                                        <span className="text-xs text-slate-400">·</span>
                                        <span className="text-xs text-slate-400">{durationStr}</span>
                                        <span className="text-xs text-slate-400">·</span>
                                        <span className="text-xs text-slate-100 font-medium">${config.price.toFixed(2)}</span>
                                        {selectedCentresPreview.length > 0 && (
                                          <>
                                            <span className="text-xs text-slate-400">·</span>
                                            <div className="flex flex-wrap gap-1">
                                              {selectedCentresPreview.map((name, idx) => (
                                                <span key={idx} className="text-xs bg-blue-900/40 text-blue-200 px-1.5 py-0.5 rounded">
                                                  ☑ {name}
                                                </span>
                                              ))}
                                              {moreCount > 0 && (
                                                <span className="text-xs text-slate-400">+{moreCount}</span>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-sm text-slate-400 italic">(Unnamed - click to edit)</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setExpandedPDAConfig(config.id)
                                  }}
                                  className="ml-4 text-blue-400 hover:text-blue-300 flex items-center gap-1 whitespace-nowrap text-sm"
                                >
                                  View/Edit
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                            
                            {/* EXPANDED VIEW */}
                            {isExpanded && (
                              <div className="border border-slate-700 bg-slate-900 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      setExpandedPDAConfig(null)
                                    }}
                                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm"
                                  >
                                    Hide
                                    <ChevronUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      removePDAConfig(config.id)
                                    }}
                                    className="text-red-400 hover:text-red-500 p-1"
                                    title="Delete this configuration"
                                  >
                                    <X className="h-5 w-5" />
                                  </button>
                                </div>

                                {/* FIX BUG-4: inline confirm replaces window.confirm() */}
                                {pdaDeleteConfirmId === config.id && (
                                  <div className="flex items-center gap-3 rounded-xl bg-red-950/40 border border-red-700/50 px-4 py-3 mt-2">
                                    <p className="flex-1 text-sm text-red-200">Delete this PDA configuration? This cannot be undone.</p>
                                    <button
                                      type="button"
                                      onClick={() => confirmRemovePDAConfig(config.id)}
                                      className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPdaDeleteConfirmId(null)}
                                      className="shrink-0 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-200">Configuration Name</label>
                                    <input
                                      type="text"
                                      value={config.name}
                                      onChange={(e) => updatePDAConfig(config.id, { name: e.target.value })}
                                      placeholder="e.g., Standard PDA Test"
                                      className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  
                                  <div className="grid sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-sm font-medium mb-1 text-slate-200">Duration (min)</label>
                                      <input
                                        type="number"
                                        value={config.durationMinutes}
                                        onChange={(e) => updatePDAConfig(config.id, { durationMinutes: parseInt(e.target.value) || 180 })}
                                        min="60"
                                        step="15"
                                        className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                      <p className="text-xs text-slate-400 mt-1">{durationStr}</p>
                                    </div>
                                    
                                    <div>
                                      <label className="block text-sm font-medium mb-1 text-slate-200">Price ($)</label>
                                      <input
                                        type="number"
                                        value={config.price}
                                        onChange={(e) => updatePDAConfig(config.id, { price: parseFloat(e.target.value) || 0 })}
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-sm font-medium mb-1 text-slate-200">Discount %</label>
                                      <input
                                        type="number"
                                        value={config.discountPercent || ''}
                                        onChange={(e) => updatePDAConfig(config.id, { discountPercent: e.target.value ? parseFloat(e.target.value) : null })}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                      {config.discountPercent && <p className="text-xs text-green-400 mt-1">${(config.price * (1 - config.discountPercent / 100)).toFixed(2)}</p>}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-200">Test Centres</label>
                                    {loadingCentres ? (
                                      <p className="text-sm text-slate-400">Loading...</p>
                                    ) : testCentres.length === 0 ? (
                                      <p className="text-sm text-slate-400">No test centres available</p>
                                    ) : (
                                      <div className="space-y-2">
                                        <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-950 rounded border border-slate-700 p-3">
                                          {testCentres.map((centre) => (
                                            <label key={centre.id} className="flex items-start gap-2 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition">
                                              <input
                                                type="checkbox"
                                                checked={config.testCentreIds?.includes(centre.id) || false}
                                                onChange={(e) => {
                                                  updatePDAConfig(config.id, {
                                                    testCentreIds: e.target.checked 
                                                      ? [...(config.testCentreIds || []), centre.id]
                                                      : (config.testCentreIds || []).filter(id => id !== centre.id)
                                                  })
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded mt-0.5 flex-shrink-0"
                                              />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium flex items-center gap-1 text-slate-200">
                                                  {centre.name}
                                                  {config.testCentreIds?.includes(centre.id) && (
                                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                  )}
                                                </p>
                                                <p className="text-xs text-slate-400">{centre.address}</p>
                                              </div>
                                            </label>
                                          ))}
                                        </div>
                                        {config.testCentreIds && config.testCentreIds.length > 0 && (
                                          <div className="bg-slate-950 border border-blue-700/30 rounded p-2">
                                            <p className="text-xs text-blue-300 font-medium mb-1">✓ Selected Centres:</p>
                                            <div className="flex flex-wrap gap-1">
                                              {config.testCentreIds.map(centreId => {
                                                const centre = testCentres.find(c => c.id === centreId)
                                                return centre ? (
                                                  <span key={centreId} className="text-xs bg-blue-900/40 text-blue-200 px-2 py-0.5 rounded">
                                                    ☑ {centre.name}
                                                  </span>
                                                ) : null
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-200">What's Included</label>
                                    <div className="space-y-2">
                                      {[
                                        { key: 'pickup' as const, label: 'Pickup from student location' },
                                        { key: 'dropoff' as const, label: 'Drop-off after test' },
                                        { key: 'debriefing' as const, label: 'Post-test debriefing' }
                                      ].map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={config.includes?.[key] ?? false}
                                            onChange={(e) => updatePDAConfig(config.id, {
                                              includes: { 
                                                pickup: config.includes?.pickup ?? true,
                                                dropoff: config.includes?.dropoff ?? true,
                                                debriefing: config.includes?.debriefing ?? true,
                                                [key]: e.target.checked 
                                              }
                                            })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                          />
                                          <span className="text-sm text-slate-200">{label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-200">Notes</label>
                                    <textarea
                                      value={config.notes}
                                      onChange={(e) => updatePDAConfig(config.id, { notes: e.target.value })}
                                      placeholder="Any special details students should know"
                                      rows={2}
                                      className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      addPDAConfig()
                    }}
                    className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add PDA Config
                  </button>
                  
                  <div className="mt-4 bg-slate-950 border border-blue-700 rounded-lg p-3">
                    <p className="text-sm text-blue-300">
                      <strong>💡 Tip:</strong> Create multiple configs with different durations and test centres. Students see all available options when booking.
                    </p>
                  </div>
                </>
              )}

              {!pdaConfigsExpanded && (
                <p className="text-sm text-slate-400 mt-2">Click to expand and manage PDA configurations</p>
              )}
            </div>

            {/* Google Calendar Settings */}
            <GoogleCalendarSettings />

            {/* AI Receptionist Voice Line */}
            {voiceLineData && (
              <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6">
                <VoiceLineDisplay
                  voiceLine={voiceLineData.voiceLine}
                  voiceLineStatus={voiceLineData.voiceLineStatus}
                  subscriptionTier={voiceLineData.subscriptionTier}
                />
              </div>
            )}

            {/* Accepting Bookings Section */}
            <div className={`rounded-3xl shadow-sm border p-6 ${!formData.acceptingBookings ? 'bg-slate-950 border-amber-700' : 'bg-slate-950 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {formData.acceptingBookings ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                    Accepting New Bookings
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {formData.acceptingBookings
                      ? 'Students can currently book lessons with you.'
                      : 'New bookings are paused. Existing confirmed bookings are unaffected.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, acceptingBookings: !prev.acceptingBookings }))}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
                    ${formData.acceptingBookings ? 'bg-green-500' : 'bg-slate-700'}`}
                  aria-label={formData.acceptingBookings ? 'Pause bookings' : 'Resume bookings'}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-slate-100 shadow transform transition-transform
                      ${formData.acceptingBookings ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              {!formData.acceptingBookings && (
                <p className="mt-3 text-sm text-amber-200 bg-amber-950/20 rounded-lg px-3 py-2">
                  ⚠️ New bookings are paused. Save settings to apply this change.
                </p>
              )}
            </div>

            {/* Cancellation Policy */}
            <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-slate-100">
                <span className="text-base">??</span>
                Platform Cancellation Policy
              </h2>
              <p className="text-xs text-slate-500 mb-4">DriveBook standard policy  applied on all bookings.</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between py-2 border-b border-slate-800"><span className="text-sm text-slate-300"> 48+ hours notice</span><span className="text-sm font-medium text-slate-200">Full refund (100%)</span></div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800"><span className="text-sm text-slate-300"> 2448 hours notice</span><span className="text-sm font-medium text-slate-200">50% refund</span></div>
                <div className="flex items-center justify-between py-2"><span className="text-sm text-slate-300">? Under 24 hours</span><span className="text-sm font-medium text-slate-200">No refund</span></div>
              </div>
              <p className="text-xs text-slate-500 mt-4">Students see this under Before You Book on your booking page.</p>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
  )
}