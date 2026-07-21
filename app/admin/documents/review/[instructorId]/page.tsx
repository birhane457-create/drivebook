'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { CheckCircle, ExternalLink, ArrowLeft, Save, Calendar, Upload, X, Trash2 } from 'lucide-react';

interface InstructorDocuments {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber?: string;
  insuranceNumber?: string;
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

interface DocField {
  key: keyof InstructorDocuments;
  label: string;
  expiryKey?: 'licenseExpiry' | 'insuranceExpiry' | 'policeCheckExpiry' | 'wwcCheckExpiry';
  required: boolean;
}

const DOC_FIELDS: DocField[] = [
  { key: 'licenseImageFront', label: 'Driver License (Front)', expiryKey: 'licenseExpiry', required: true },
  { key: 'licenseImageBack', label: 'Driver License (Back)', required: true },
  { key: 'insurancePolicyDoc', label: 'Insurance Policy', expiryKey: 'insuranceExpiry', required: true },
  { key: 'policeCheckDoc', label: 'Police Check', expiryKey: 'policeCheckExpiry', required: true },
  { key: 'wwcCheckDoc', label: 'Working with Children Check', expiryKey: 'wwcCheckExpiry', required: true },
  { key: 'photoIdDoc', label: 'Photo ID', required: true },
  { key: 'certificationDoc', label: 'Instructor Certification', required: false },
  { key: 'vehicleRegistrationDoc', label: 'Vehicle Registration', required: true },
];

function trafficLight(expiry: string | undefined, hasDoc: boolean): 'green' | 'yellow' | 'red' {
  if (!hasDoc) return 'red';
  if (!expiry) return 'yellow';
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return 'red';
  if (days < 30) return 'yellow';
  return 'green';
}

function TrafficDot({ color }: { color: 'green' | 'yellow' | 'red' }) {
  const cls = color === 'green' ? 'bg-green-900/200' : color === 'yellow' ? 'bg-yellow-400' : 'bg-red-900/200';
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 ${cls}`}>
      {color === 'green' ? '\u2713' : color === 'yellow' ? '!' : '\u2717'}
    </span>
  );
}

export default function DocumentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const instructorId = params.instructorId as string;

  const [instructor, setInstructor] = useState<InstructorDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { fetchDocs(); }, [instructorId]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/documents/instructor/${instructorId}`);
      if (res.ok) {
        const data = await res.json();
        setInstructor(data);
        setExpiry({
          licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry).toISOString().split('T')[0] : '',
          insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry).toISOString().split('T')[0] : '',
          policeCheckExpiry: data.policeCheckExpiry ? new Date(data.policeCheckExpiry).toISOString().split('T')[0] : '',
          wwcCheckExpiry: data.wwcCheckExpiry ? new Date(data.wwcCheckExpiry).toISOString().split('T')[0] : '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveExpiry = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/documents/instructor/${instructorId}/expiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expiry),
    });
    setSaving(false);
    if (res.ok) { showToast('Expiry dates saved'); fetchDocs(); }
    else showToast('Failed to save');
  };

  const approveAll = async () => {
    setApproving(true);
    const res = await fetch(`/api/admin/documents/instructor/${instructorId}/approve`, { method: 'POST' });
    setApproving(false);
    if (res.ok) { showToast('Documents approved'); fetchDocs(); }
    else showToast('Failed to approve');
  };

  const handleUpload = async (field: string, file: File) => {
    setUploading(field);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('field', field);
    const res = await fetch(`/api/admin/documents/instructor/${instructorId}/upload`, {
      method: 'POST',
      body: fd,
    });
    setUploading(null);
    if (res.ok) { showToast('Document uploaded'); fetchDocs(); }
    else showToast('Upload failed');
  };

  const [removeConfirmField, setRemoveConfirmField] = useState<string | null>(null);

  const removeDoc = async (field: string) => {
    setRemoveConfirmField(null);
    const res = await fetch(`/api/admin/documents/instructor/${instructorId}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, remove: true }),
    });
    if (res.ok) { showToast('Document removed'); fetchDocs(); }
    else showToast('Failed to remove');
  };

  const [rejectingField, setRejectingField] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const rejectDoc = async (field: string, label: string) => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection');
      return;
    }
    setRejectingField(null);
    const res = await fetch(`/api/admin/documents/instructor/${instructorId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentKey: field, reason: rejectReason }),
    });
    setRejectReason('');
    if (res.ok) { showToast(`${label} rejected and instructor notified`); fetchDocs(); }
    else showToast('Failed to reject document');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav />
      <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>
    </div>
  );

  if (!instructor) return (
    <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav />
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-400">Instructor not found</div>
    </div>
  );

  const lights = DOC_FIELDS.filter(f => f.expiryKey).map(f =>
    trafficLight(expiry[f.expiryKey!], !!instructor[f.key])
  );
  const overall = lights.includes('red') ? 'red' : lights.includes('yellow') ? 'yellow' : 'green';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-950 text-white text-sm px-4 py-2 rounded-xl shadow-lg">{toast}</div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-300 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-100">{instructor.name}</h1>
              <p className="text-sm text-slate-400">{instructor.email} &middot; {instructor.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <TrafficDot color={overall} />
              <span className={`text-sm font-semibold ${overall === 'green' ? 'text-green-700' : overall === 'yellow' ? 'text-yellow-600' : 'text-red-600'}`}>
                {overall === 'green' ? 'All valid' : overall === 'yellow' ? 'Attention needed' : 'Action required'}
              </span>
            </div>
          </div>
          {instructor.documentsVerified && (
            <p className="mt-2 text-xs text-green-600">
              Verified{instructor.documentsVerifiedAt ? ` on ${new Date(instructor.documentsVerifiedAt).toLocaleDateString('en-AU')}` : ''}
            </p>
          )}
        </div>

        {/* Document rows */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden mb-5">
          <div className="grid grid-cols-[1.5rem_1fr_9rem_auto_auto] gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wide items-center">
            <div></div>
            <div>Document</div>
            <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />Expiry</div>
            <div>File</div>
            <div>Upload</div>
          </div>

          <div className="divide-y divide-slate-800">
            {DOC_FIELDS.map(field => {
              const docUrl = instructor[field.key] as string | undefined;
              const hasDoc = !!docUrl;
              const light = field.expiryKey
                ? trafficLight(expiry[field.expiryKey], hasDoc)
                : hasDoc ? 'green' : 'red';
              const isUploading = uploading === field.key;

              return (
                <div key={field.key} className="grid grid-cols-[1.5rem_1fr_9rem_auto_auto] gap-2 items-center px-4 py-3">
                  <TrafficDot color={light} />

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                    </p>
                    <p className="text-xs text-slate-500">{!hasDoc ? 'Not uploaded' : !field.expiryKey ? 'Uploaded' : ''}</p>
                  </div>

                  {/* Expiry input */}
                  <div>
                    {field.expiryKey ? (
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="date"
                          value={expiry[field.expiryKey] || ''}
                          onChange={e => setExpiry(prev => ({ ...prev, [field.expiryKey!]: e.target.value }))}
                          className={`text-xs border rounded-lg px-2 py-1.5 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none
                            ${light === 'red' ? 'border-red-300 bg-red-900/20' : light === 'yellow' ? 'border-yellow-300 bg-yellow-900/20' : 'border-slate-700 bg-slate-900'}`}
                        />
                        <span className={`text-xs font-medium ${light === 'red' ? 'text-red-500' : light === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {expiry[field.expiryKey] ? (light === 'red' ? 'Expired' : light === 'yellow' ? 'Expiring soon' : 'Valid') : 'No date set'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">N/A</span>
                    )}
                  </div>

                  {/* View / Remove / Reject */}
                  <div className="flex items-center gap-1">
                    {hasDoc ? (
                      <>
                        <a href={docUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-300">
                          <ExternalLink className="w-3.5 h-3.5" />View
                        </a>
                        <button 
                          onClick={() => setRejectingField(field.key as string)}
                          className="text-slate-500 hover:text-red-400 ml-1" 
                          title="Reject and notify instructor">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {removeConfirmField === field.key ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => removeDoc(field.key as string)}
                              className="text-xs bg-red-700 text-white px-1.5 py-0.5 rounded hover:bg-red-600"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => setRemoveConfirmField(null)}
                              className="text-xs text-slate-500 hover:text-white"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setRemoveConfirmField(field.key as string)}
                            className="text-slate-500 hover:text-slate-300 ml-1" title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">None</span>
                    )}
                  </div>

                  {/* Upload button */}
                  <div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      ref={el => { fileInputRefs.current[field.key as string] = el; }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(field.key as string, f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[field.key as string]?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-900 hover:bg-blue-900/20 text-slate-400 hover:text-blue-700 rounded-lg border border-slate-700 hover:border-blue-300 disabled:opacity-40 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {isUploading ? 'Uploading...' : hasDoc ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expiry summary */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-4 mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Expiry Summary</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Driver License', key: 'licenseExpiry' },
              { label: 'Insurance', key: 'insuranceExpiry' },
              { label: 'Police Check', key: 'policeCheckExpiry' },
              { label: 'WWC Check', key: 'wwcCheckExpiry' },
            ].map(({ label, key }) => {
              const val = expiry[key];
              const light = val ? trafficLight(val, true) : 'yellow';
              return (
                <div key={key} className={`flex items-center justify-between rounded-lg px-3 py-2 border
                  ${light === 'red' ? 'bg-red-900/20 border-red-700/50' : light === 'yellow' ? 'bg-yellow-900/20 border-yellow-700/50' : 'bg-green-900/20 border-green-700/50'}`}>
                  <span className="text-xs font-medium text-slate-300">{label}</span>
                  <span className={`text-xs font-semibold ${light === 'red' ? 'text-red-600' : light === 'yellow' ? 'text-yellow-600' : 'text-green-700'}`}>
                    {val ? new Date(val).toLocaleDateString('en-AU') : 'Not set'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={saveExpiry} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-40">
            <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Expiry Dates'}
          </button>
          <button onClick={approveAll} disabled={approving}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 disabled:opacity-40">
            <CheckCircle className="w-4 h-4" />{approving ? 'Approving...' : 'Approve All Documents'}
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectingField && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-100 mb-1">Reject Document</h3>
            <p className="text-sm text-slate-400 mb-4">
              {DOC_FIELDS.find(f => f.key === rejectingField)?.label}
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Reason for rejection</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this document is being rejected..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setRejectingField(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 text-sm rounded-lg hover:bg-slate-700 border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectDoc(rejectingField, DOC_FIELDS.find(f => f.key === rejectingField)?.label || 'Document')}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                Reject & Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
