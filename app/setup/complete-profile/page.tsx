'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, User, Car, FileText, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

interface ProfileData {
  name: string
  phone: string
  bio: string
  profileImage: string
  carImage: string
  carMake: string
  carModel: string
  carYear: number | null
  licenseNumber: string
  insuranceNumber: string
}

export default function CompleteProfilePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadingProfile, setUploadingProfile] = useState(false)
  const [uploadingCar, setUploadingCar] = useState(false)
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    phone: '',
    bio: '',
    profileImage: '',
    carImage: '',
    carMake: '',
    carModel: '',
    carYear: null,
    licenseNumber: '',
    insuranceNumber: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/instructor/profile')
      if (res.ok) {
        const data = await res.json()
        setFormData(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const calculateProgress = () => {
    const fields = [
      formData.name,
      formData.phone,
      formData.bio,
      formData.profileImage,
      formData.carImage,
      formData.carMake,
      formData.carModel,
      formData.licenseNumber
    ]
    const completed = fields.filter(f => f && f.toString().trim() !== '').length
    return Math.round((completed / fields.length) * 100)
  }

  const handleImageUpload = async (file: File, type: 'profile' | 'car') => {
    const setUploading = type === 'profile' ? setUploadingProfile : setUploadingCar
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setFormData(prev => ({
          ...prev,
          [type === 'profile' ? 'profileImage' : 'carImage']: data.url
        }))
      } else {
        alert('Failed to upload image')
      }
    } catch (error) {
      alert('Error uploading image')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/instructor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        // Update settings with license info
        await fetch('/api/instructor/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseNumber: formData.licenseNumber,
            insuranceNumber: formData.insuranceNumber
          })
        })

        router.push('/dashboard')
      } else {
        alert('Failed to update profile')
      }
    } catch (error) {
      alert('Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  const progress = calculateProgress()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Circle */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#e5e7eb"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#3b82f6"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600">{progress}%</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
          <p className="text-gray-600">Help students find and trust you</p>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s ? <CheckCircle2 className="h-6 w-6" /> : s}
                </div>
                {s < 4 && (
                  <div className={`w-16 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold">Personal Information</h2>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bio / About You *</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="Tell students about your experience, teaching style, and qualifications..."
                />
                <p className="text-sm text-gray-500 mt-1">{formData.bio?.length || 0} characters</p>
              </div>
            </div>
          )}

          {/* Step 2: Profile Picture */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Camera className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold">Profile Picture</h2>
              </div>

              <div className="text-center">
                {formData.profileImage ? (
                  <div className="relative inline-block">
                    <Image
                      src={formData.profileImage}
                      alt="Profile"
                      width={200}
                      height={200}
                      className="rounded-full object-cover mx-auto"
                    />
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, profileImage: '' }))}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-full mx-auto flex items-center justify-center">
                    <Camera className="h-16 w-16 text-gray-400" />
                  </div>
                )}

                <label className="mt-4 inline-block cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                  {uploadingProfile ? 'Uploading...' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'profile')}
                    disabled={uploadingProfile}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">Professional photo helps build trust</p>
              </div>
            </div>
          )}

          {/* Step 3: Car Details */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Car className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold">Training Vehicle</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Make *</label>
                  <input
                    type="text"
                    value={formData.carMake}
                    onChange={(e) => setFormData(prev => ({ ...prev, carMake: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="Toyota"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Model *</label>
                  <input
                    type="text"
                    value={formData.carModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, carModel: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                    placeholder="Corolla"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Year</label>
                <input
                  type="number"
                  value={formData.carYear || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, carYear: parseInt(e.target.value) || null }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="2023"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Car Photo</label>
                {formData.carImage ? (
                  <div className="relative inline-block">
                    <Image
                      src={formData.carImage}
                      alt="Car"
                      width={300}
                      height={200}
                      className="rounded-lg object-cover"
                    />
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, carImage: '' }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Camera className="h-12 w-12 text-gray-400" />
                  </div>
                )}

                <label className="mt-4 inline-block cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                  {uploadingCar ? 'Uploading...' : 'Upload Car Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'car')}
                    disabled={uploadingCar}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Professional Details */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-semibold">Professional Details</h2>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Driving Instructor License Number *</label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="DI-123456"
                />
                <p className="text-sm text-gray-500 mt-1">Your professional instructor license</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Insurance Policy Number</label>
                <input
                  type="text"
                  value={formData.insuranceNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, insuranceNumber: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="INS-789012"
                />
                <p className="text-sm text-gray-500 mt-1">Vehicle insurance policy number</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Why we need this:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Verify your professional credentials</li>
                  <li>• Build trust with students</li>
                  <li>• Comply with regulations</li>
                  <li>• Protect you and your students</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            )}
            
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="ml-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Complete Profile'}
              </button>
            )}
          </div>

          {/* Skip Option */}
          <div className="text-center mt-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip for now (complete later)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
