'use client'

import { useState, useEffect } from 'react'
import { Calendar, RefreshCw, Link as LinkIcon, Unlink, CheckCircle2, AlertCircle } from 'lucide-react'

export default function GoogleCalendarSettings() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [bufferMode, setBufferMode] = useState<'auto' | 'manual'>('auto')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    checkConnection()
    
    // Check for success/error in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'calendar_connected') {
      setMessage('Google Calendar connected successfully!')
      setConnected(true)
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/settings')
    }
    if (params.get('error')) {
      setMessage(`Error: ${params.get('error')}`)
    }
  }, [])

  const checkConnection = async () => {
    try {
      const res = await fetch('/api/google-calendar')
      if (res.ok) {
        const data = await res.json()
        setConnected(data.connected)
        setBufferMode(data.bufferMode || 'auto')
      }
    } catch (error) {
      console.error('Check connection error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBufferModeChange = async (mode: 'auto' | 'manual') => {
    try {
      setSavingSettings(true)
      const res = await fetch('/api/google-calendar/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bufferMode: mode })
      })
      
      if (res.ok) {
        setBufferMode(mode)
        setMessage(`Buffer mode updated to ${mode === 'auto' ? 'Automatic' : 'Manual'}`)
      }
    } catch (error) {
      console.error('Update settings error:', error)
      setMessage('Failed to update settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleConnect = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/google-calendar', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error('Connect error:', error)
      setMessage('Failed to connect')
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return

    try {
      setLoading(true)
      const res = await fetch('/api/google-calendar', { method: 'DELETE' })
      if (res.ok) {
        setConnected(false)
        setMessage('Google Calendar disconnected')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      setMessage('Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch('/api/google-calendar/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setMessage(`Synced ${data.eventsProcessed} events successfully!`)
      } else {
        const error = await res.json()
        setMessage(`Sync failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Sync error:', error)
      setMessage('Failed to sync calendar')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Google Calendar Integration
      </h2>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
          message.includes('Error') || message.includes('Failed')
            ? 'bg-red-50 text-red-800'
            : 'bg-green-50 text-green-800'
        }`}>
          {message.includes('Error') || message.includes('Failed') ? (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 mb-2">
            <strong>What this does:</strong>
          </p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Syncs your Google Calendar events</li>
            <li>Automatically blocks booking times for your appointments</li>
            <li>Detects PDA tests and blocks 2 hours before + 1 hour after</li>
            <li>Prevents double bookings</li>
            <li>Syncs automatically every hour</li>
          </ul>
          <div className="mt-3 pt-3 border-t border-blue-300">
            <a 
              href="/dashboard/help" 
              className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
            >
              📖 View detailed guide on how to use keywords →
            </a>
          </div>
        </div>

        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Connected to Google Calendar</span>
            </div>

            {/* Buffer Mode Setting */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">PDA Test Buffer Mode</h3>
              <p className="text-sm text-gray-600 mb-3">
                Choose how the system handles PDA test blocking times:
              </p>
              
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition">
                  <input
                    type="radio"
                    name="bufferMode"
                    checked={bufferMode === 'auto'}
                    onChange={() => handleBufferModeChange('auto')}
                    disabled={savingSettings}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Automatic Buffer</div>
                    <div className="text-sm text-gray-600">
                      System automatically blocks 2 hours before + 1 hour after PDA tests.
                      <br />
                      <span className="text-xs italic">Example: Test at 10:00-11:00 → Blocks 8:00-12:00</span>
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition">
                  <input
                    type="radio"
                    name="bufferMode"
                    checked={bufferMode === 'manual'}
                    onChange={() => handleBufferModeChange('manual')}
                    disabled={savingSettings}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Manual Buffer</div>
                    <div className="text-sm text-gray-600">
                      You set the exact times in Google Calendar (include buffer yourself).
                      <br />
                      <span className="text-xs italic">Example: Create event 8:00-12:00 → Blocks 8:00-12:00</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Last sync: Automatic sync runs every hour. Click "Sync Now" to sync immediately.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Connect your Google Calendar to automatically block times when you have other appointments.
            </p>

            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LinkIcon className="h-5 w-5" />
              {loading ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>Privacy:</strong> We only read your calendar events to block booking times. We never modify or delete your calendar events.
          </p>
        </div>
      </div>
    </div>
  )
}
