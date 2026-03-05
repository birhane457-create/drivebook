'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';

interface InstructorDocuments {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseImageFront?: string;
  licenseImageBack?: string;
  insurancePolicyDoc?: string;
  policeCheckDoc?: string;
  wwcCheckDoc?: string;
  photoIdDoc?: string;
  certificationDoc?: string;
  vehicleRegistrationDoc?: string;
  licenseExpiry?: string;
  insuranceExpiry?: string;
  policeCheckExpiry?: string;
  wwcCheckExpiry?: string;
  documentsVerified: boolean;
  documentsVerifiedAt?: string;
}

interface DocumentField {
  key: string;
  label: string;
  expiryKey?: string;
  required: boolean;
}

const documentFields: DocumentField[] = [
  { key: 'licenseImageFront', label: "Driver's License (Front)", expiryKey: 'licenseExpiry', required: true },
  { key: 'licenseImageBack', label: "Driver's License (Back)", required: true },
  { key: 'insurancePolicyDoc', label: 'Insurance Policy', expiryKey: 'insuranceExpiry', required: true },
  { key: 'policeCheckDoc', label: 'Police Check', expiryKey: 'policeCheckExpiry', required: true },
  { key: 'wwcCheckDoc', label: 'Working with Children Check', expiryKey: 'wwcCheckExpiry', required: true },
  { key: 'photoIdDoc', label: 'Photo ID', required: true },
  { key: 'certificationDoc', label: 'Instructor Certification', required: false },
  { key: 'vehicleRegistrationDoc', label: 'Vehicle Registration', required: true },
];

export default function DocumentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = params.instructorId as string;

  const [instructor, setInstructor] = useState<InstructorDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expiryDates, setExpiryDates] = useState<{ [key: string]: string }>({});
  const [rejectionReasons, setRejectionReasons] = useState<{ [key: string]: string }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchInstructorDocuments();
  }, [instructorId]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInstructorDocuments = async () => {
    try {
      const res = await fetch(`/api/admin/documents/instructor/${instructorId}`);
      if (res.ok) {
        const data = await res.json();
        setInstructor(data);
        
        // Initialize expiry dates
        setExpiryDates({
          licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry).toISOString().split('T')[0] : '',
          insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry).toISOString().split('T')[0] : '',
          policeCheckExpiry: data.policeCheckExpiry ? new Date(data.policeCheckExpiry).toISOString().split('T')[0] : '',
          wwcCheckExpiry: data.wwcCheckExpiry ? new Date(data.wwcCheckExpiry).toISOString().split('T')[0] : '',
        });
      } else {
        showToast('error', 'Failed to load instructor documents.');
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      showToast('error', 'Failed to load instructor documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpiryDates = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/documents/instructor/${instructorId}/expiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expiryDates),
      });

      if (res.ok) {
        showToast('success', 'Expiry dates saved successfully.');
        fetchInstructorDocuments();
      } else {
        showToast('error', 'Failed to save expiry dates.');
      }
    } catch (error) {
      console.error('Failed to save expiry dates:', error);
      showToast('error', 'Failed to save expiry dates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveDocuments = async () => {
    if (!confirm('Approve all documents for this instructor?')) return;

    try {
      const res = await fetch(`/api/admin/documents/instructor/${instructorId}/approve`, {
        method: 'POST',
      });

      if (res.ok) {
        showToast('success', 'Documents approved successfully.');
        fetchInstructorDocuments();
      } else {
        showToast('error', 'Failed to approve documents.');
      }
    } catch (error) {
      console.error('Failed to approve documents:', error);
      showToast('error', 'Failed to approve documents. Please try again.');
    }
  };

  const handleRejectDocument = async (documentKey: string, reason?: string) => {
    const rejectionReason = reason || prompt(`Enter rejection reason for this document:`);
    if (!rejectionReason) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/documents/instructor/${instructorId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentKey, reason: rejectionReason }),
      });

      if (res.ok) {
        showToast('success', 'Document rejected. Instructor will be notified.');
        fetchInstructorDocuments();
      } else {
        showToast('error', 'Failed to reject document.');
      }
    } catch (error) {
      console.error('Failed to reject document:', error);
      showToast('error', 'Failed to reject document. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Instructor not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Compliance Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Review Documents</h1>
          <div className="mt-2">
            <p className="text-lg font-semibold">{instructor.name}</p>
            <p className="text-gray-600">{instructor.email}</p>
            <p className="text-gray-600">{instructor.phone}</p>
          </div>
        </div>

        {/* Verification Status */}
        <div className={`mb-6 p-4 rounded-lg ${
          instructor.documentsVerified 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className="font-semibold">
            {instructor.documentsVerified 
              ? `✅ Documents Verified on ${new Date(instructor.documentsVerifiedAt!).toLocaleDateString()}`
              : '⏳ Documents Pending Verification'}
          </p>
        </div>

        {/* Documents Review */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Compact Table View */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documentFields
                .filter(field => {
                  if (!searchQuery) return true;
                  return field.label.toLowerCase().includes(searchQuery.toLowerCase());
                })
                .map((field) => {
                  const docUrl = instructor[field.key as keyof InstructorDocuments] as string | undefined;
                  const hasDoc = !!docUrl;

                  return (
                    <tr key={field.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {hasDoc ? (
                          <span className="text-green-600 text-xl">✓</span>
                        ) : (
                          <span className="text-red-600 text-xl">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          {!hasDoc && (
                            <p className="text-xs text-gray-500">Waiting for upload</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {field.expiryKey && hasDoc ? (
                          <input
                            type="date"
                            value={expiryDates[field.expiryKey] || ''}
                            onChange={(e) => setExpiryDates({
                              ...expiryDates,
                              [field.expiryKey!]: e.target.value
                            })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasDoc ? (
                          <div className="flex gap-2">
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              View
                            </a>
                            <button
                              onClick={() => {
                                const reason = prompt(`Rejection reason for ${field.label}:`);
                                if (reason) {
                                  handleRejectDocument(field.key);
                                }
                              }}
                              className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No document</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleSaveExpiryDates}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save Expiry Dates'}
          </button>
          <button
            onClick={handleApproveDocuments}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            ✓ Approve All Documents
          </button>
        </div>
      </div>

      {/* Toast notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm text-white ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
