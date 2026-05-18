'use client'

import { useState, useEffect } from 'react'
import { Camera, Car, Save, MapPin, Plus, X } from 'lucide-react'
import Image from 'next/image'

interface ServiceArea {
  id: string
  postcode: string
  suburb: string
  state: string
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(false)
  const [profileImage, setProfileImage] = useState<string>('')
  const [carImage, setCarImage] = useState<string>('')
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([])
  const [newPostcode, setNewPostcode] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    bio: '',
    carMake: '',
    carModel: '',
    carYear: '',
    hourlyRate: '',
    vehicleTypes: [] as string[],
    serviceRadiusKm: '',
    baseAddress: '',
    licenseNumber: '',
    insuranceNumber: '',
    languages: [] as string[],
    whatsapp: '',
    instagram: '',
    facebook: '',
    yearsExperience: '',
  })
  const [newLanguage, setNewLanguage] = useState('')

  useEffect(() => {
    fetchProfile()
    fetchServiceAreas()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/instructor/profile')
      if (res.ok) {
        const data = await res.json()
        
        // Convert comma-separated strings to arrays
        const vehicleTypesArray = data.vehicleTypes 
          ? (typeof data.vehicleTypes === 'string' ? data.vehicleTypes.split(',').map((t: string) => t.trim()) : data.vehicleTypes)
          : []
        
        const languagesArray = data.languages
          ? (typeof data.languages === 'string' ? data.languages.split(',').map((l: string) => l.trim()) : data.languages)
          : []
        
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          carMake: data.carMake || '',
          carModel: data.carModel || '',
          carYear: data.carYear || '',
          hourlyRate: data.hourlyRate || '',
          vehicleTypes: vehicleTypesArray,
          serviceRadiusKm: data.serviceRadiusKm || '',
          baseAddress: data.baseAddress || '',
          licenseNumber: data.licenseNumber || '',
          insuranceNumber: data.insuranceNumber || '',
          languages: languagesArray,
          whatsapp: data.whatsapp || '',
          instagram: data.instagram || '',
          facebook: data.facebook || '',
          yearsExperience: data.yearsExperience || '',
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'car') => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (type === 'profile') {
          setProfileImage(data.url)
        } else {
          setCarImage(data.url)
        }
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload image')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/instructor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          profileImage,
          carImage,
          carYear: formData.carYear ? parseInt(formData.carYear) : null,
          yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : null,
          whatsapp: formData.whatsapp || null,
          instagram: formData.instagram || null,
          facebook: formData.facebook || null,
          baseAddress: formData.baseAddress || null,
          licenseNumber: formData.licenseNumber || null,
          insuranceNumber: formData.insuranceNumber || null,
          languages: formData.languages,
        }),
      })

      if (res.ok) {
        alert('Profile updated successfully!')
      } else {
        alert('Failed to update profile')
      }
    } catch (error) {
      console.error('Update failed:', error)
      alert('Failed to update profile')
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
        alert('Failed to add service area')
      }
    } catch (error) {
      console.error('Failed to add service area:', error)
      alert('Failed to add service area')
    }
  }

  const removeServiceArea = async (id: string) => {
    try {
      const res = await fetch(`/api/instructor/service-areas/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setServiceAreas(serviceAreas.filter(area => area.id !== id))
      }
    } catch (error) {
      console.error('Failed to remove service area:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Profile</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Profile Photo</h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                {profileImage ? (
                  <Image
                    src={profileImage}
                    alt="Profile"
                    width={120}
                    height={120}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center">
                    <Camera className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 w-full">
                <label className="block">
                  <span className="sr-only">Choose profile photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'profile')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  placeholder="Tell clients about yourself, your experience, teaching style..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Car Information */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Car Information</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Car Photo</label>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  {carImage ? (
                    <Image
                      src={carImage}
                      alt="Car"
                      width={200}
                      height={150}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-48 h-36 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Car className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 w-full">
                  <label className="block">
                    <span className="sr-only">Choose car photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'car')}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Make</label>
                <input
                  type="text"
                  value={formData.carMake}
                  onChange={(e) => setFormData({ ...formData, carMake: e.target.value })}
                  placeholder="Toyota"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={formData.carModel}
                  onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                  placeholder="Corolla"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <input
                  type="number"
                  value={formData.carYear}
                  onChange={(e) => setFormData({ ...formData, carYear: e.target.value })}
                  placeholder="2020"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Business Information</h2>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
                    title="Change this in Settings"
                  />
                  <p className="text-xs text-gray-500 mt-1">Change in Settings page</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Service Radius (km)</label>
                  <input
                    type="number"
                    value={formData.serviceRadiusKm}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600"
                    title="Change this in Settings"
                  />
                  <p className="text-xs text-gray-500 mt-1">Change in Settings page</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Base Address</label>
                <input
                  type="text"
                  value={formData.baseAddress}
                  onChange={(e) => setFormData({ ...formData, baseAddress: e.target.value })}
                  placeholder="e.g. Maylands WA 6051"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">Your home base — only the suburb is shown publicly</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vehicle Types</label>
                <div className="flex gap-2">
                  {formData.vehicleTypes.map((type) => (
                    <span
                      key={type}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {type}
                    </span>
                  ))}
                  {formData.vehicleTypes.length === 0 && (
                    <span className="text-gray-500 text-sm">No vehicle types set</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Change in Settings page</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Languages</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.languages.map((lang) => (
                    <span
                      key={lang}
                      className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                    >
                      {lang}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, languages: formData.languages.filter(l => l !== lang) })}
                        className="ml-1 text-green-600 hover:text-red-600"
                      >
                        ×
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
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 text-sm"
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
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Press Enter or click Add. Shown on your public profile.</p>
              </div>
            </div>
          </div>

          {/* Professional Credentials */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Professional Credentials</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Instructor License Number</label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  placeholder="e.g. DI12345"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                {!formData.licenseNumber && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Not provided — complete your profile</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Insurance Policy Number</label>
                <input
                  type="text"
                  value={formData.insuranceNumber}
                  onChange={(e) => setFormData({ ...formData, insuranceNumber: e.target.value })}
                  placeholder="e.g. POL-2024-XXXXX"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                {!formData.insuranceNumber && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Not provided — complete your profile</p>
                )}
              </div>

              {(!formData.licenseNumber || !formData.insuranceNumber) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    Complete your professional credentials to increase trust with students.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Service Areas */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Service Areas (Postcodes)
            </h2>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPostcode}
                onChange={(e) => setNewPostcode(e.target.value)}
                placeholder="Enter postcode (e.g., 6051)"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={addServiceArea}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {serviceAreas.map((area) => (
                <div
                  key={area.id}
                  className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg flex items-center gap-2"
                >
                  <span className="font-medium">{area.postcode}</span>
                  {area.suburb && <span className="text-sm">({area.suburb})</span>}
                  <button
                    type="button"
                    onClick={() => removeServiceArea(area.id)}
                    className="hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {serviceAreas.length === 0 && (
                <p className="text-gray-500 text-sm">No service areas added yet</p>
              )}
            </div>
          </div>

          {/* Social Links & Public Profile */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-1">Social Links</h2>
            <p className="text-sm text-gray-500 mb-4">These appear on your public booking page</p>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Years of Experience</label>
                  <input
                    type="number"
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                    placeholder="e.g. 5"
                    min="0"
                    max="50"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="e.g. 61412345678"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">Include country code, no spaces (e.g. 61412345678)</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Instagram Handle</label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="e.g. yourhandle (without @)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Facebook Page URL or Username</label>
                <input
                  type="text"
                  value={formData.facebook}
                  onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  placeholder="e.g. yourpage or https://facebook.com/yourpage"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-5 w-5" />
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
