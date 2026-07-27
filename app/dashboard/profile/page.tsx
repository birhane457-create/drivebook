'use client'

import { useState, useEffect } from 'react'
import { Camera, Car, Save, MapPin, Plus, X, ChevronDown, Video, Tag, CheckCircle, AlertCircle, Sparkles, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

interface ServiceArea {
  id: string
  postcode: string
  suburb: string
  state: string
}

// ── Toast helper ─────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error'
interface Toast { type: ToastType; message: string }

export default function ProfilePage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [profileImage, setProfileImage] = useState<string>('')
  const [carImage, setCarImage] = useState<string>('')
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([])
  const [newPostcode, setNewPostcode] = useState('')
  const [saved, setSaved] = useState(false)
  // FIX BUG-3: toast replaces all alert() calls
  const [toast, setToast] = useState<Toast | null>(null)
  // Collapsible sections (default open on desktop, collapsed on small screens)
  const [vehicleOpen, setVehicleOpen] = useState(true)
  const [locationOpen, setLocationOpen] = useState(true)
  const [langOpen, setLangOpen] = useState(true)
  const [videoOpen, setVideoOpen] = useState(true)
  const [specialtiesOpen, setSpecialtiesOpen] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    bio: '',
    carMake: '',
    carModel: '',
    carYear: '',
    baseAddress: '',
    languages: [] as string[],
    yearsExperience: '',
    vehicleTypes: [] as string[],
    videoUrl: '',
    specialties: [] as string[],
  })
  const [newLanguage, setNewLanguage] = useState('')
  const [generatingBio, setGeneratingBio] = useState(false)

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const generateBio = async () => {
    setGeneratingBio(true)
    try {
      const res = await fetch('/api/instructor/bio-generate', { method: 'POST' })
      if (res.ok) {
        const { bio } = await res.json()
        setFormData(f => ({ ...f, bio }))
        showToast('success', 'Draft bio generated — review and edit before saving.')
      } else {
        showToast('error', 'Could not generate bio. Please write it manually.')
      }
    } catch {
      showToast('error', 'Could not generate bio. Please check your connection.')
    } finally {
      setGeneratingBio(false)
    }
  }

  useEffect(() => {
    fetchProfile()
    fetchServiceAreas()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/instructor/profile')
      if (res.ok) {
        const data = await res.json()
        const languagesArray = data.languages
          ? (typeof data.languages === 'string'
              ? data.languages.split(',').map((l: string) => l.trim())
              : data.languages)
          : []
        const vehicleTypesArray = data.vehicleTypes
          ? (typeof data.vehicleTypes === 'string'
              ? data.vehicleTypes.split(',').map((v: string) => v.trim()).filter(Boolean)
              : data.vehicleTypes)
          : []
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          carMake: data.carMake || '',
          carModel: data.carModel || '',
          carYear: data.carYear || '',
          baseAddress: data.baseAddress || '',
          languages: languagesArray,
          yearsExperience: data.yearsExperience?.toString() || '',
          vehicleTypes: vehicleTypesArray,
          videoUrl: data.videoUrl || '',
          specialties: data.specialties
            ? (typeof data.specialties === 'string'
                ? data.specialties.split(',').map((s: string) => s.trim()).filter(Boolean)
                : data.specialties)
            : [],
        })
        setProfileImage(data.profileImage || '')
        setCarImage(data.carImage || '')
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const fetchServiceAreas = async () => {
    try {
      const res = await fetch('/api/instructor/service-areas')
      if (res.ok) {
        const data = await res.json()
        setServiceAreas(data)
      }
    } catch (error) {
      console.error('Failed to fetch service areas:', error)
    }
  }

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'profile' | 'car'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        type === 'profile' ? setProfileImage(data.url) : setCarImage(data.url)
      } else {
        showToast('error', 'Failed to upload image. Please try again.')
      }
    } catch {
      showToast('error', 'Failed to upload image. Check your connection and try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    try {
      const res = await fetch('/api/instructor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          profileImage,
          carImage,
          carYear: formData.carYear ? String(formData.carYear) : null,
          yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : null,
          baseAddress: formData.baseAddress || null,
          languages: formData.languages,
          videoUrl: formData.videoUrl || null,
          specialties: formData.specialties,
        }),
      })
      // Also save vehicleTypes through settings API (stored as comma-string in DB)
      const settingsRes = await fetch('/api/instructor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleTypes: formData.vehicleTypes }),
      })
      if (res.ok && settingsRes.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        showToast('error', 'Failed to save profile. Please try again.')
      }
    } catch {
      showToast('error', 'Failed to save profile. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const addServiceArea = async () => {
    if (!newPostcode.trim()) return
    try {
      const res = await fetch('/api/instructor/service-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcode: newPostcode }),
      })
      if (res.ok) {
        const data = await res.json()
        setServiceAreas([...serviceAreas, data])
        setNewPostcode('')
      } else {
        showToast('error', 'Failed to add service area. Please try again.')
      }
    } catch {
      showToast('error', 'Failed to add service area. Check your connection and try again.')
    }
  }

  const removeServiceArea = async (id: string) => {
    try {
      const res = await fetch(`/api/instructor/service-areas/${id}`, { method: 'DELETE' })
      if (res.ok) setServiceAreas(serviceAreas.filter(a => a.id !== id))
    } catch {
      console.error('Failed to remove service area')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* FIX BUG-3: toast notification replaces all alert() calls */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Profile</h1>
        {saved && (
          <span className="text-sm text-emerald-400 font-medium">✓ Saved</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Photos ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-100 mb-4">Photos</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Profile photo */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Profile photo</p>
              <div className="flex items-center gap-4">
                {profileImage ? (
                  <Image src={profileImage} alt="Profile" width={72} height={72} className="rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                    <Camera className="h-7 w-7 text-slate-500" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'profile')}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
                />
              </div>
            </div>
            {/* Car photo */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Car photo</p>
              <div className="flex items-center gap-4">
                {carImage ? (
                  <Image src={carImage} alt="Car" width={96} height={64} className="rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-24 h-16 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                    <Car className="h-7 w-7 text-slate-500" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'car')}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Basic Info ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
          <h2 className="text-base font-bold text-slate-100 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone <span className="text-red-400">*</span></label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Bio</label>
                <button
                  type="button"
                  onClick={generateBio}
                  disabled={generatingBio}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-violet-900/40 text-violet-300 border border-violet-700/40 hover:bg-violet-900/70 hover:text-violet-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingBio
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-3 w-3" /> Draft with AI</>
                  }
                </button>
              </div>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                placeholder="Describe your experience, teaching style, and what makes you a great instructor..."
                className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400 resize-none"
              />
              {/* Word count — 75 word minimum for SEO and profile quality */}
              {(() => {
                const words = formData.bio.trim() ? formData.bio.trim().split(/\s+/).filter(Boolean).length : 0;
                const met = words >= 75;
                return (
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-500">
                      {met
                        ? 'Shown on your public booking page — first impressions matter.'
                        : '⚠️ Minimum 75 words required for your profile to appear in search results.'}
                    </p>
                    <span className={`text-[11px] font-medium tabular-nums ${met ? 'text-emerald-400' : words > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                      {words}/75 words
                    </span>
                  </div>
                );
              })()}
              {generatingBio && (
                <p className="text-[11px] text-violet-400 mt-1">
                  AI is drafting your bio… this takes a few seconds.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Years of Experience</label>
              <input
                type="number"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                placeholder="e.g. 5"
                min="0" max="50"
                className="w-32 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
              />
            </div>

            {/* Email — read-only, from User account */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={session?.user?.email || ''}
                readOnly
                className="w-full px-3 py-2 border border-slate-700 bg-slate-900 text-slate-400 rounded-lg text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                This is your login email. To change it,{' '}
                <Link href="/contact" className="text-violet-400 hover:underline no-underline">contact support</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* ── Car Details ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setVehicleOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
          >
            <h2 className="text-base font-bold text-slate-100">Teaching Vehicle</h2>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${vehicleOpen ? 'rotate-180' : ''}`} />
          </button>

          {vehicleOpen && (
          <div className="px-5 pb-5 space-y-4">
            {/* Vehicle types */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Transmission Type <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-4">
                {[
                  { value: 'MANUAL', label: 'Manual' },
                  { value: 'AUTO', label: 'Automatic' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.vehicleTypes.includes(value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, vehicleTypes: [...formData.vehicleTypes, value] })
                        } else {
                          setFormData({ ...formData, vehicleTypes: formData.vehicleTypes.filter(v => v !== value) })
                        }
                      }}
                      className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                    />
                    <span className="text-sm text-slate-200">{label}</span>
                  </label>
                ))}
              </div>
              {formData.vehicleTypes.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">⚠️ Select at least one transmission type</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Make</label>
                <input
                  type="text"
                  value={formData.carMake}
                  onChange={(e) => setFormData({ ...formData, carMake: e.target.value })}
                  placeholder="Toyota"
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Model</label>
                <input
                  type="text"
                  value={formData.carModel}
                  onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                  placeholder="Yaris"
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Year</label>
                <input
                  type="text"
                  value={formData.carYear}
                  onChange={(e) => setFormData({ ...formData, carYear: e.target.value })}
                  placeholder="2022"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                />
              </div>
            </div>
          </div>
          )}
        </section>

        {/* ── Location & Service Areas ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setLocationOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
          >
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              Location
            </h2>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
          </button>

          {locationOpen && (
          <div className="px-5 pb-5">
            <p className="text-[11px] text-slate-500 mb-4">
              Your base address and postcodes you travel to.{' '}
              <Link href="/dashboard/settings" className="text-violet-400 hover:underline no-underline">
                Service radius is in Settings →
              </Link>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Base Address</label>
                <input
                  type="text"
                  value={formData.baseAddress}
                  onChange={(e) => setFormData({ ...formData, baseAddress: e.target.value })}
                  placeholder="e.g. Maylands WA 6051"
                  className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">Only the suburb name is shown publicly</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Service Postcodes</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newPostcode}
                    onChange={(e) => setNewPostcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addServiceArea() } }}
                    placeholder="Enter postcode (e.g. 6051)"
                    className="flex-1 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={addServiceArea}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map((area) => (
                    <div key={area.id} className="bg-slate-800 text-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                      <span className="font-medium">{area.postcode}</span>
                      {area.suburb && <span className="text-slate-400 text-xs">({area.suburb})</span>}
                      <button
                        type="button"
                        onClick={() => removeServiceArea(area.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {serviceAreas.length === 0 && (
                    <p className="text-slate-500 text-xs">No postcodes added yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        {/* ── Languages ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setLangOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
          >
            <h2 className="text-base font-bold text-slate-100">Languages</h2>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>

          {langOpen && (
          <div className="px-5 pb-5">
            <p className="text-[11px] text-slate-500 mb-3">Shown on your public profile — students filter by language</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.languages.map((lang) => (
                <span key={lang} className="bg-slate-800 text-slate-100 px-3 py-1 rounded-full text-sm flex items-center gap-1.5">
                  {lang}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, languages: formData.languages.filter(l => l !== lang) })}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const lang = newLanguage.trim()
                    if (lang && !formData.languages.includes(lang)) {
                      setFormData({ ...formData, languages: [...formData.languages, lang] })
                      setNewLanguage('')
                    }
                  }
                }}
                placeholder="e.g. English, Arabic, Tigrinya"
                className="flex-1 px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  const lang = newLanguage.trim()
                  if (lang && !formData.languages.includes(lang)) {
                    setFormData({ ...formData, languages: [...formData.languages, lang] })
                    setNewLanguage('')
                  }
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                Add
              </button>
            </div>
          </div>
          )}
        </section>

        {/* ── Video Intro ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setVideoOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
          >
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Video className="h-4 w-4 text-slate-400" />
              Video Intro
            </h2>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${videoOpen ? 'rotate-180' : ''}`} />
          </button>

          {videoOpen && (
            <div className="px-5 pb-5 space-y-3">
              <p className="text-[11px] text-slate-500">
                Paste a YouTube or Vimeo link. A short "meet your instructor" video builds trust better than any written bio.
              </p>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm placeholder-slate-400"
              />
              {formData.videoUrl && (() => {
                // Live preview — extract video ID and show thumbnail
                const ytMatch = formData.videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&\s?/]+)/)
                const viMatch = formData.videoUrl.match(/vimeo\.com\/(\d+)/)
                if (ytMatch) {
                  return (
                    <div className="rounded-lg overflow-hidden border border-slate-700 mt-2">
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title="Video preview"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 px-3 py-2">Preview of what students will see</p>
                    </div>
                  )
                }
                if (viMatch) {
                  return (
                    <div className="rounded-lg overflow-hidden border border-slate-700 mt-2">
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          src={`https://player.vimeo.com/video/${viMatch[1]}`}
                          className="absolute inset-0 w-full h-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title="Video preview"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 px-3 py-2">Preview of what students will see</p>
                    </div>
                  )
                }
                return (
                  <p className="text-[11px] text-amber-400 mt-1">⚠️ Paste a YouTube or Vimeo URL to see a preview</p>
                )
              })()}
            </div>
          )}
        </section>

        {/* ── Teaching Specialties ── */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setSpecialtiesOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
          >
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Tag className="h-4 w-4 text-slate-400" />
              Teaching Specialties
            </h2>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${specialtiesOpen ? 'rotate-180' : ''}`} />
          </button>

          {specialtiesOpen && (
            <div className="px-5 pb-5 space-y-3">
              <p className="text-[11px] text-slate-500">
                Select tags that describe who you teach best. Shown as chips on your booking page — students scan these quickly.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Nervous learners', 'First-timers', 'Intensive lessons',
                  'Manual specialist', 'Automatic specialist',
                  'International licence holders', 'Seniors', 'Teenagers',
                  'ADHD-friendly', 'Anxiety support', 'Test prep focus',
                  'Refresher lessons', 'Highway / Freeway', 'Defensive driving',
                ].map((tag) => {
                  const selected = formData.specialties.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setFormData({ ...formData, specialties: formData.specialties.filter(s => s !== tag) })
                        } else {
                          setFormData({ ...formData, specialties: [...formData.specialties, tag] })
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {selected ? '✓ ' : ''}{tag}
                    </button>
                  )
                })}
              </div>
              {formData.specialties.length > 0 && (
                <p className="text-[11px] text-slate-500">{formData.specialties.length} selected</p>
              )}
            </div>
          )}
        </section>

        {/* Save */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      {/* Quick links to related pages */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { href: '/dashboard/branding', icon: '🎨', label: 'Branding & Social', desc: 'Logo, colours, social links' },
          { href: '/dashboard/settings', icon: '⚙️', label: 'Pricing & Radius', desc: 'Rate, hours, service radius' },
          { href: '/dashboard/documents', icon: '📄', label: 'Documents', desc: 'Licence, insurance, credentials' },
        ].map(({ href, icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col gap-1 p-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-all no-underline group"
          >
            <span className="text-base">{icon}</span>
            <p className="text-xs font-semibold text-slate-200">{label}</p>
            <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
