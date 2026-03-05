'use client'

import { useState, useEffect } from 'react'
import { Upload, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

interface Documents {
  licenseImageFront?: string
  licenseImageBack?: string
  insurancePolicyDoc?: string
  policeCheckDoc?: string
  wwcCheckDoc?: string
  photoIdDoc?: string
  certificationDoc?: string
  vehicleRegistrationDoc?: string
  profileImage?: string
  carImage?: string
  documentsVerified: boolean
  documentsVerifiedAt?: string
  licenseExpiry?: string
  insuranceExpiry?: string
  policeCheckExpiry?: string
  wwcCheckExpiry?: string
}

interface DocumentItem {
  key: keyof Documents
  label: string
  description: string
  required: boolean
  type: 'image' | 'pdf'
  expiryKey?: keyof Documents
}

const documentTypes: DocumentItem[] = [
  {
    key: 'licenseImageFront',
    label: "License (Front)",
    description: 'Front of driver\'s license',
    required: true,
    type: 'image',
    expiryKey: 'licenseExpiry',
  },
  {
    key: 'licenseImageBack',
    label: "License (Back)",
    description: 'Back of driver\'s license',
    required: true,
    type: 'image',
  },
  {
    key: 'insurancePolicyDoc',
    label: 'Insurance Policy',
    description: 'Current insurance document',
    required: true,
    type: 'pdf',
    expiryKey: 'insuranceExpiry',
  },
  {
    key: 'policeCheckDoc',
    label: 'Police Check',
    description: 'Background check (< 12 months)',
    required: true,
    type: 'pdf',
    expiryKey: 'policeCheckExpiry',
  },
  {
    key: 'wwcCheckDoc',
    label: 'WWC Check',
    description: 'Working with Children',
    required: true,
    type: 'pdf',
    expiryKey: 'wwcCheckExpiry',
  },
  {
    key: 'photoIdDoc',
    label: 'Photo ID',
    description: 'Passport or ID',
    required: true,
    type: 'image',
  },
  {
    key: 'certificationDoc',
    label: 'Certification',
    description: 'Instructor certification',
    required: false,
    type: 'pdf',
  },
  {
    key: 'vehicleRegistrationDoc',
    label: 'Vehicle Rego',
    description: 'Vehicle registration',
    required: true,
    type: 'pdf',
  },
]

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Documents | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/instructor/documents')
      const data = await res.json()
      setDocuments(data)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (documentType: string, file: File) => {
    setUploading(documentType)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', documentType)

      const res = await fetch('/api/instructor/documents', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        await fetchDocuments()
        alert('Document uploaded successfully!')
      } else {
        const error = await res.json()
        alert(error.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document')
    } finally {
      setUploading(null)
    }
  }

  const getExpiryStatus = (expiryKey?: keyof Documents) => {
    if (!expiryKey || !documents || !documents[expiryKey]) {
      return { status: 'none', icon: '⚪', color: 'text-gray-400' }
    }

    const expiryDate = new Date(documents[expiryKey] as string)
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    if (expiryDate < now) {
      return { status: 'expired', icon: '🔴', color: 'text-red-600', text: 'Expired' }
    } else if (expiryDate < thirtyDaysFromNow) {
      return { status: 'expiring', icon: '🟡', color: 'text-yellow-600', text: 'Expiring Soon' }
    } else {
      return { status: 'valid', icon: '🟢', color: 'text-green-600', text: 'Valid' }
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-AU')
  }

  const filteredDocuments = documentTypes.filter(doc => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return doc.label.toLowerCase().includes(query) || 
           doc.description.toLowerCase().includes(query)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Verification Documents</h1>
          <p className="mt-2 text-gray-600">
            Upload and manage your verification documents
          </p>
        </div>

        {/* Verification Status */}
        {documents && (
          <div className={`mb-6 p-4 rounded-lg ${
            documents.documentsVerified 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center gap-3">
              {documents.documentsVerified ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Documents Verified</h3>
                    <p className="text-sm text-green-700">
                      Verified on {new Date(documents.documentsVerifiedAt!).toLocaleDateString()}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-6 w-6 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold text-yellow-900">Pending Verification</h3>
                    <p className="text-sm text-yellow-700">
                      Upload all required documents for admin review
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Compact Documents Grid */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map((doc) => {
                const hasDoc = documents?.[doc.key]
                const isUploading = uploading === doc.key
                const expiryStatus = getExpiryStatus(doc.expiryKey)

                return (
                  <tr key={doc.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {hasDoc ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Uploaded</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-gray-400" />
                            <span className="text-sm text-gray-500">Not Uploaded</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.label}
                          {doc.required && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <p className="text-xs text-gray-500">{doc.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {doc.expiryKey && documents?.[doc.expiryKey] ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{expiryStatus.icon}</span>
                          <div>
                            <p className={`text-sm font-medium ${expiryStatus.color}`}>
                              {expiryStatus.text}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(documents[doc.expiryKey] as string)}
                            </p>
                          </div>
                        </div>
                      ) : doc.expiryKey && hasDoc ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚪</span>
                          <span className="text-sm text-gray-500">Pending Review</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {hasDoc && (
                          <a
                            href={hasDoc as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            View
                          </a>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept={doc.type === 'image' ? 'image/*' : '.pdf'}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleFileUpload(doc.key, file)
                              }
                            }}
                            className="hidden"
                            disabled={isUploading}
                          />
                          <span className={`text-sm ${
                            isUploading
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-blue-600 hover:text-blue-800'
                          }`}>
                            {isUploading ? 'Uploading...' : hasDoc ? 'Replace' : 'Upload'}
                          </span>
                        </label>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">Document Status Guide</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">Upload Status:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• ✅ Uploaded: Document received</li>
                <li>• ❌ Not Uploaded: Please upload</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">Expiry Status:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 🟢 Valid: Document current</li>
                <li>• 🟡 Expiring Soon: Renew within 30 days</li>
                <li>• 🔴 Expired: Upload new document</li>
                <li>• ⚪ Pending Review: Awaiting admin verification</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">Requirements:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• All documents must be clear and readable</li>
              <li>• Images: JPG or PNG format</li>
              <li>• PDFs: Less than 10MB</li>
              <li>• Documents marked with * are required</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
