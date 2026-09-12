'use client'
import { DashboardPageLayout } from '@/components/ui'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronRight,
         Upload, FileText, User, Settings, Shield, CreditCard, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useBusinessConfig } from '@/hooks/useBusinessConfig'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  // profile completeness
  name?: string
  phone?: string
  bio?: string
  hourlyRate?: number
  baseAddress?: string
  workingHours?: unknown
  abn?: string
  abnVerified?: boolean
  subscriptionStatus?: string
}

interface DocItem {
  key: keyof Documents
  label: string
  description: string
  required: boolean
  type: 'image' | 'pdf'
  expiryKey?: keyof Documents
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function expiryStatus(docs: Documents, expiryKey?: keyof Documents) {
  if (!expiryKey || !docs[expiryKey]) return null
  const exp = new Date(docs[expiryKey] as string)
  const now = new Date()
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (exp < now)  return { label: 'Expired',       colour: 'text-destructive',    dot: 'bg-red-500' }
  if (exp < soon) return { label: 'Expiring soon', colour: 'text-amber-400',  dot: 'bg-amber-500' }
  return              { label: 'Valid',            colour: 'text-emerald-400', dot: 'bg-emerald-500' }
}

function fmtDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Next-step banner ──────────────────────────────────────────────────────────

function NextStepBanner({ docs, uploadedCount, requiredCount, docTypes }: {
  docs: Documents
  uploadedCount: number
  requiredCount: number
  docTypes: DocItem[]
}) {
  if (docs.documentsVerified) {
    // Check for any expiring docs
    const expiring = docTypes.filter(d => {
      if (!d.expiryKey) return false
      const s = expiryStatus(docs, d.expiryKey)
      return s && (s.label === 'Expired' || s.label === 'Expiring soon')
    })
    if (expiring.length > 0) {
      return (
        <div className="mb-5 flex items-start gap-3 bg-amber-950/40 border border-amber-700/60 rounded-2xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-200">Action needed: {expiring.length} document{expiring.length > 1 ? 's' : ''} expiring</p>
            <p className="text-xs text-amber-300/80 mt-0.5">Renew {expiring.map(d => d.label).join(', ')} to keep your payouts active.</p>
          </div>
        </div>
      )
    }
    return (
      <div className="mb-5 flex items-start gap-3 bg-emerald-950/40 border border-emerald-700/60 rounded-2xl p-4">
        <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">All documents verified — you're fully approved</p>
          <p className="text-xs text-emerald-300/80 mt-0.5">Keep your documents current. You'll get alerts 30 days before any expiry.</p>
        </div>
      </div>
    )
  }

  if (uploadedCount < requiredCount) {
    const remaining = requiredCount - uploadedCount
    const nextMissing = docTypes.find(d => d.required && !docs[d.key])
    return (
      <div className="mb-5 flex items-start gap-3 bg-sky-950/40 border border-sky-700/60 rounded-2xl p-4">
        <Upload className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-sky-200">
            Next step: Upload {nextMissing?.label ?? 'remaining documents'}
          </p>
          <p className="text-xs text-primary/80 mt-0.5">
            {uploadedCount} of {requiredCount} required documents uploaded. {remaining} more needed before admin review.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-5 flex items-start gap-3 bg-violet-950/40 border border-violet-700/60 rounded-2xl p-4">
      <Clock className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-violet-200">All documents uploaded — awaiting admin review</p>
        <p className="text-xs text-violet-300/80 mt-0.5">We'll notify you once your documents are verified. This usually takes 1–2 business days.</p>
      </div>
    </div>
  )
}

// ── Completion checklist item ─────────────────────────────────────────────────

function CheckItem({ done, label, subtitle, href }: {
  done: boolean; label: string; subtitle: string; href?: string
}) {
  const inner = (
    <>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
        done ? 'bg-emerald-500' : 'bg-secondary/70 border-2 border-slate-500'
      }`}>
        {done && <CheckCircle className="h-4 w-4 text-foreground" strokeWidth={2.5} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-emerald-200' : 'text-foreground'}`}>{label}</p>
        <p className="text-xs text-muted-foreground/60 truncate">{subtitle}</p>
      </div>
      {!done && href && <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />}
      {done && <span className="text-xs text-emerald-500 font-medium flex-shrink-0">Done</span>}
    </>
  )
  // Always use the same wrapper element to avoid hydration mismatch
  const className = `flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
    done
      ? 'bg-emerald-950/20 border-emerald-800/40'
      : 'bg-secondary/60 border-border/60 hover:border-border'
  }`
  if (!done && href) {
    return (
      <Link href={href} className={`no-underline ${className}`}>
        {inner}
      </Link>
    )
  }
  return <div className={className}>{inner}</div>
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc, docs, uploading, onUpload }: {
  doc: DocItem
  docs: Documents
  uploading: string | null
  onUpload: (key: string, file: File) => void
}) {
  const hasDoc = !!docs[doc.key]
  const expiry = expiryStatus(docs, doc.expiryKey)
  const expiryDate = doc.expiryKey ? fmtDate(docs[doc.expiryKey] as string | undefined) : null
  const isUploading = uploading === doc.key
  const [open, setOpen] = useState(false) // collapsed by default — tap to open

  const statusLabel = hasDoc ? 'Uploaded' : doc.required ? 'Required' : 'Optional'
  const statusColour = hasDoc ? 'text-emerald-400' : doc.required ? 'text-amber-400' : 'text-muted-foreground/60'
  const dotColour = hasDoc ? 'bg-emerald-500' : doc.required ? 'bg-amber-500' : 'bg-slate-600'

  return (
    <div className={`border-b border-border last:border-b-0 ${!hasDoc && doc.required ? 'bg-amber-950/10' : ''}`}>
      {/* Row header — tap to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
      >
        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dotColour}`} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{doc.label}</span>
          {doc.required && !hasDoc && <span className="ml-1.5 text-xs text-amber-500">required</span>}
          {expiry && (
            <span className={`ml-2 text-xs ${expiry.colour}`}>{expiry.label}</span>
          )}
        </div>
        <span className={`text-xs font-medium flex-shrink-0 ${statusColour}`}>{statusLabel}</span>
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 ml-1" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 ml-1" />
        }
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-4 pb-4 pt-1 bg-card/50 space-y-3">
          <p className="text-xs text-muted-foreground">{doc.description}</p>

          {hasDoc && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                Document on file
              </div>
              {expiryDate && (
                <span className={`text-xs ${expiry?.colour ?? 'text-muted-foreground'}`}>
                  Expires {expiryDate}
                </span>
              )}
              {/* Use signed URL endpoint — never expose raw Cloudinary URL */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/instructor/documents/${doc.key}`);
                    if (res.ok) {
                      const { url } = await res.json();
                      if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }
                    }
                  } catch { /* silent — document still visible in portal */ }
                }}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary transition"
              >
                <ExternalLink className="h-3 w-3" /> View
              </button>
            </div>
          )}

          {/* Upload button */}
          <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
            isUploading
              ? 'bg-secondary/70 text-muted-foreground cursor-not-allowed'
              : hasDoc
              ? 'bg-secondary/70 hover:bg-slate-600 text-foreground border border-border'
              : 'bg-violet-600 hover:bg-violet-500 text-foreground shadow-lg shadow-violet-900/40'
          }`}>
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading…' : hasDoc ? 'Replace document' : 'Upload document'}
            <input
              type="file"
              accept={doc.type === 'image' ? 'image/*' : '.pdf,image/*'}
              onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(doc.key, f) }}
              className="hidden"
              disabled={isUploading}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {doc.type === 'image' ? 'JPG, PNG' : 'PDF or image'} · Max 10 MB
          </p>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { isDriving, customers: termCustomers } = useBusinessConfig()
  const [docs, setDocs] = useState<Documents | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Document types — vehicle rego only for driving instructors
  const DOC_TYPES: DocItem[] = [
    { key: 'licenseImageFront',   label: 'Licence (Front)',   description: "Front of your driver's licence",         required: true,  type: 'image', expiryKey: 'licenseExpiry' },
    { key: 'licenseImageBack',    label: 'Licence (Back)',    description: "Back of your driver's licence",          required: true,  type: 'image' },
    { key: 'insurancePolicyDoc',  label: 'Insurance Policy', description: 'Current instructor insurance document',  required: true,  type: 'pdf',   expiryKey: 'insuranceExpiry' },
    { key: 'policeCheckDoc',      label: 'Police Check',     description: 'Background check (less than 12 months)', required: true,  type: 'pdf',   expiryKey: 'policeCheckExpiry' },
    { key: 'wwcCheckDoc',         label: 'WWC Check',        description: 'Working with Children card',             required: true,  type: 'pdf',   expiryKey: 'wwcCheckExpiry' },
    { key: 'photoIdDoc',          label: 'Photo ID',         description: 'Passport or government-issued ID',       required: true,  type: 'image' },
    ...(isDriving ? [
      { key: 'vehicleRegistrationDoc' as keyof Documents, label: 'Vehicle Rego', description: 'Current vehicle registration', required: true, type: 'pdf' as const },
    ] : []),
    { key: 'certificationDoc',    label: 'Certification',    description: 'Instructor certification (if applicable)', required: false, type: 'pdf' },
  ]
  const [uploading, setUploading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => { fetchDocs() }, [])

  const fetchDocs = async () => {
    try {
      const [docsRes, profileRes] = await Promise.all([
        fetch('/api/instructor/documents'),
        fetch('/api/instructor/profile'),
      ])

      // ── IMPORTANT: never spread the full profile response into docs ──
      // Profile returns fields like workingHours (object → truthy) and profileImage
      // which could accidentally make document presence checks return the wrong result.
      // Extract ONLY the specific profile fields we need for the completeness checklist.
      const docsData    = docsRes.ok    ? await docsRes.json()    : {}
      const profileRaw  = profileRes.ok ? await profileRes.json() : {}

      const profileFields = {
        name:               profileRaw.name               ?? null,
        phone:              profileRaw.phone              ?? null,
        bio:                profileRaw.bio                ?? null,
        hourlyRate:         profileRaw.hourlyRate         ?? null,
        baseAddress:        profileRaw.baseAddress        ?? null,
        workingHours:       profileRaw.workingHours       ?? null,
        abn:                profileRaw.abn                ?? null,
        abnVerified:        profileRaw.abnVerified        ?? false,
        subscriptionStatus: profileRaw.subscriptionStatus ?? null,
      }

      setDocs({ ...docsData, ...profileFields })
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const handleUpload = async (key: string, file: File) => {
    setUploading(key)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', key)
      const res = await fetch('/api/instructor/documents', { method: 'POST', body: fd })
      if (res.ok) {
        await fetchDocs()
        setToast({ msg: 'Document uploaded successfully', ok: true })
      } else {
        const err = await res.json()
        setToast({ msg: err.error || 'Upload failed', ok: false })
      }
    } catch {
      setToast({ msg: 'Upload failed — please try again', ok: false })
    } finally {
      setUploading(null)
      setTimeout(() => setToast(null), 3500)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
      </div>
    )
  }

  if (!docs) return <p className="text-muted-foreground p-6">Failed to load documents.</p>

  const uploadedCount = DOC_TYPES.filter(d => d.required && docs[d.key]).length
  const requiredCount = DOC_TYPES.filter(d => d.required).length
  const allUploaded = uploadedCount >= requiredCount

  // Completion checklist items
  const profileDone = !!(docs.name && docs.phone && docs.bio && docs.hourlyRate && docs.baseAddress)
  const settingsDone = !!(docs.workingHours && JSON.stringify(docs.workingHours) !== '{}')
  const taxDone = !!(docs.abn && docs.abnVerified)
  const docsDone = allUploaded
  const fullyVerified = docs.documentsVerified

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl transition-all ${
          toast.ok ? 'bg-emerald-800 text-emerald-100' : 'bg-red-900 text-red-100'
        }`}>
          {toast.ok ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete all steps to start accepting bookings</p>
      </div>

      {/* Next step banner */}
      <NextStepBanner docs={docs} uploadedCount={uploadedCount} requiredCount={requiredCount} docTypes={DOC_TYPES} />

      {/* ── Overall progress checklist ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-foreground">Setup Progress</h2>
          <span className="ml-auto text-xs text-muted-foreground/60">
            {[profileDone, settingsDone, taxDone, docsDone, fullyVerified].filter(Boolean).length} / 5
          </span>
        </div>
        <div className="p-3 space-y-2">
          <CheckItem
            done={profileDone}
            label="Profile complete"
            subtitle={profileDone ? 'Name, phone, bio, rate and address set' : 'Add your bio, hourly rate and base address'}
            href="/dashboard/profile"
          />
          <CheckItem
            done={settingsDone}
            label="Working hours set"
            subtitle={settingsDone ? `${termCustomers} can see your availability` : 'Set your working days and hours'}
            href="/dashboard/settings"
          />
          <CheckItem
            done={taxDone}
            label="Tax / ABN verified"
            subtitle={taxDone ? 'ABN verified — payouts active' : 'Add and verify your ABN for payouts'}
            href="/dashboard/settings"
          />
          <CheckItem
            done={docsDone}
            label={`Documents uploaded (${uploadedCount}/${requiredCount})`}
            subtitle={docsDone ? 'All required documents on file' : 'Upload your licence, insurance and other required docs below'}
          />
          <CheckItem
            done={fullyVerified}
            label="Admin verification"
            subtitle={fullyVerified
              ? `Verified on ${fmtDate(docs.documentsVerifiedAt)}`
              : docsDone ? 'Awaiting admin review (1–2 business days)' : 'Complete document uploads first'}
          />
        </div>
      </div>

      {/* ── Documents list ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-foreground">Verification Documents</h2>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            fullyVerified ? 'bg-emerald-900/40 text-emerald-400'
            : allUploaded  ? 'bg-violet-900/40 text-violet-400'
            : 'bg-amber-900/40 text-amber-400'
          }`}>
            {fullyVerified ? 'Verified' : allUploaded ? 'Under review' : `${uploadedCount}/${requiredCount} uploaded`}
          </span>
        </div>

        {/* Required docs first, optional at bottom */}
        {[...DOC_TYPES.filter(d => d.required), ...DOC_TYPES.filter(d => !d.required)].map(doc => (
          <DocRow
            key={doc.key}
            doc={doc}
            docs={docs}
            uploading={uploading}
            onUpload={handleUpload}
          />
        ))}
      </div>

      {/* ── Other account sections ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Settings className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-foreground">Other Account Sections</h2>
        </div>
        <div className="p-3 space-y-2">
          <Link href="/dashboard/profile" className="no-underline flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-border hover:bg-secondary/60 transition-all">
            <User className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Profile</p>
              <p className="text-xs text-muted-foreground/60">Name, bio, photo, car, hourly rate</p>
            </div>
            {profileDone
              ? <span className="text-xs text-emerald-500 font-medium">Complete</span>
              : <span className="text-xs text-amber-500 font-medium">Incomplete</span>
            }
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </Link>
          <Link href="/dashboard/settings" className="no-underline flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-border hover:bg-secondary/60 transition-all">
            <Settings className="h-4 w-4 text-violet-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Settings & Tax</p>
              <p className="text-xs text-muted-foreground/60">Working hours, ABN, payout settings</p>
            </div>
            {taxDone && settingsDone
              ? <span className="text-xs text-emerald-500 font-medium">Complete</span>
              : <span className="text-xs text-amber-500 font-medium">Incomplete</span>
            }
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </Link>
          <Link href="/dashboard/subscription" className="no-underline flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-border hover:bg-secondary/60 transition-all">
            <CreditCard className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Subscription & Billing</p>
              <p className="text-xs text-muted-foreground/60">Plan, payment method, payout account</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </Link>
          <Link href="/instructor-terms" className="no-underline flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-border hover:bg-secondary/60 transition-all">
            <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Terms & Policies</p>
              <p className="text-xs text-muted-foreground/60">Instructor terms, privacy policy</p>
            </div>
            <span className="text-xs text-emerald-500 font-medium">Accepted</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </Link>
        </div>
      </div>

    </div>
  )
}
