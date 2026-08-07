'use client'

// app/dashboard/settings/security/page.tsx
//
// Recognised Devices — shows browsers that have recently signed in,
// lets the instructor remove individual or all-other devices.
//
// IMPORTANT LIMITATION:
// Removing a device deletes its LoginDevice record. This does NOT
// immediately end an existing session — if that browser has a valid
// JWT it can continue using DriveBook until the JWT expires or the
// user changes their password (assuming password-reset revocation is
// implemented — see SEC-3 in TODO).
//
// The page uses the label "Recognised Devices" not "Active Sessions"
// because that is what the database actually tracks: browsers that
// have previously authenticated, not necessarily live sessions.

import { useState, useEffect } from 'react'
import { Monitor, Smartphone, Trash2, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react'
import { DEVICE_STORAGE_KEY } from '@/lib/services/deviceTracking'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeviceRecord {
  id: string
  deviceName: string       // "Chrome on Windows"
  lastUsedAt: string       // ISO string
  firstSeenAt: string      // ISO string
  trusted: boolean
  isCurrentDevice: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deviceIcon(deviceName: string) {
  const lower = deviceName.toLowerCase()
  if (lower.includes('ios') || lower.includes('android')) {
    return <Smartphone className="w-5 h-5 text-slate-400 shrink-0" />
  }
  return <Monitor className="w-5 h-5 text-slate-400 shrink-0" />
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)  // device id being removed
  const [removingAll, setRemovingAll] = useState(false)
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false)
  const [migrationPending, setMigrationPending] = useState(false)

  // Read the device token from localStorage to send in the header
  // so the server can identify which device is "current"
  function getDeviceToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(DEVICE_STORAGE_KEY)
  }

  async function loadDevices() {
    setLoading(true)
    setError(null)
    try {
      const token = getDeviceToken()
      const res = await fetch('/api/instructor/devices', {
        headers: token ? { 'X-Device-Token': token } : {},
      })

      if (res.status === 503) {
        setMigrationPending(true)
        return
      }

      if (!res.ok) {
        setError('Could not load devices. Please try again.')
        return
      }

      const data = await res.json()
      // Sort: current device first, then most recent
      const sorted = [...data].sort((a: DeviceRecord, b: DeviceRecord) => {
        if (a.isCurrentDevice) return -1
        if (b.isCurrentDevice) return 1
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
      })
      setDevices(sorted)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
  }, [])

  async function removeDevice(id: string) {
    setRemoving(id)
    try {
      const token = getDeviceToken()
      const res = await fetch(`/api/instructor/devices/${id}`, {
        method: 'DELETE',
        headers: token ? { 'X-Device-Token': token } : {},
      })
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.id !== id))
      } else {
        setError('Could not remove device. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  async function removeAllOthers() {
    setRemovingAll(true)
    setConfirmRemoveAll(false)
    try {
      const token = getDeviceToken()
      const res = await fetch('/api/instructor/devices', {
        method: 'DELETE',
        headers: token ? { 'X-Device-Token': token } : {},
      })
      if (res.ok) {
        // Keep only the current device in the local list
        setDevices(prev => prev.filter(d => d.isCurrentDevice))
      } else {
        setError('Could not remove devices. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRemovingAll(false)
    }
  }

  const otherDevices = devices.filter(d => !d.isCurrentDevice)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-sky-400" />
          Security Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage browsers that have recently signed in to your DriveBook account.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 text-red-400 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* Migration pending state */}
      {migrationPending && (
        <div className="bg-amber-900/20 border border-amber-700/40 text-amber-400 text-sm rounded-xl px-4 py-4 space-y-1">
          <p className="font-semibold">Device tracking not yet active</p>
          <p className="text-amber-400/70">
            The device tracking database table is pending a migration. Once deployed, recognised devices will appear here.
          </p>
        </div>
      )}

      {/* Devices card */}
      {!migrationPending && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">

          {/* Card header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                Recognised Devices
                {!loading && (
                  <span className="text-[11px] font-semibold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                    {devices.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Browsers that have signed in to your account
              </p>
            </div>
            <button
              onClick={loadDevices}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Device list */}
          {loading ? (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              Loading devices…
            </div>
          ) : devices.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              No recognised devices yet. This list appears after your first sign-in with device tracking active.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {devices.map(device => (
                <li key={device.id} className="flex items-center gap-4 px-5 py-4">
                  {deviceIcon(device.deviceName)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-200 truncate">
                        {device.deviceName}
                      </span>
                      {device.isCurrentDevice && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last seen {relativeTime(device.lastUsedAt)}
                    </p>
                  </div>

                  {/* Remove button — hidden for current device */}
                  {!device.isCurrentDevice && (
                    <button
                      onClick={() => removeDevice(device.id)}
                      disabled={removing === device.id}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:border-red-700/60 hover:text-red-400 hover:bg-red-900/10 disabled:opacity-40 transition-all"
                      title="Remove this device"
                    >
                      {removing === device.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Remove all others */}
          {otherDevices.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40">
              {confirmRemoveAll ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-slate-400 flex-1 min-w-[180px]">
                    Remove {otherDevices.length} other {otherDevices.length === 1 ? 'device' : 'devices'}?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmRemoveAll(false)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={removeAllOthers}
                      disabled={removingAll}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1"
                    >
                      {removingAll && <RefreshCw className="w-3 h-3 animate-spin" />}
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemoveAll(true)}
                  className="text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
                >
                  Remove all other recognised devices ({otherDevices.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      {!migrationPending && (
        <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
          <p>
            <strong className="text-slate-500">What does "recognised" mean?</strong>{' '}
            A recognised device is a browser that has previously signed in to your account.
            It does not mean the browser currently has an active session.
          </p>
          <p>
            <strong className="text-slate-500">What happens when you remove a device?</strong>{' '}
            The browser is removed from your recognised list. If it signs in again, it will be
            treated as a new device and you will receive a security notification email.
            Removing a device does not immediately end an existing session — if the browser
            already has a valid login session, it remains active until that session naturally
            expires.
          </p>
          <p>
            If you believe your account has been compromised, change your password immediately.
          </p>
        </div>
      )}
    </div>
  )
}
