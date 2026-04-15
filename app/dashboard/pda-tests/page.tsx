'use client'

import { useState, useEffect } from 'react'
import {
  Car, Calendar, MapPin, Plus, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Edit2, Save, X, Loader2, User, Phone, Mail, DollarSign
} from 'lucide-react'

interface PDATest {
  id: string
  testDate: string
  testTime: string
  testCenterName: string
  testCenterAddress: string
  result: string
  price: number
  status: string
  client: { name: string; phone: string; email: string }
}

interface Client { id: string; name: string; phone: string; email: string }
interface TestCentre { id: string; name: string; address: string; suburb: string; region: string | null }

const resultColor = (r: string) =>
  r === 'PASS' ? 'bg-green-100 text-green-800' :
  r === 'FAIL' ? 'bg-red-100 text-red-800' :
  'bg-yellow-100 text-yellow-800'

const resultIcon = (r: string) =>
  r === 'PASS' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
  r === 'FAIL' ? <XCircle className="h-5 w-5 text-red-600" /> :
  <Clock className="h-5 w-5 text-yellow-600" />

export default function PDATestsPage() {
  const [tests, setTests] = useState<PDATest[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [centres, setCentres] = useState<TestCentre[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editResult, setEditResult] = useState('')
  const [defaultPrice, setDefaultPrice] = useState<number>(0)

  const [form, setForm] = useState({
    clientId: '',
    testDate: '',
    testTime: '',
    testCentreId: '',
    price: '',
    notes: '',
  })

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const [testsRes, clientsRes, centresRes, settingsRes] = await Promise.all([
        fetch('/api/pda-tests'),
        fetch('/api/clients'),
        fetch('/api/test-centres'),
        fetch('/api/instructor/test-package'),
      ])
      if (testsRes.ok) setTests(await testsRes.json())
      if (clientsRes.ok) {
        const d = await clientsRes.json()
        setClients(Array.isArray(d) ? d : [])
      }
      if (centresRes.ok) setCentres(await centresRes.json())
      if (settingsRes.ok) {
        const s = await settingsRes.json()
        if (s.testPackagePrice) {
          setDefaultPrice(s.testPackagePrice)
          setForm(f => ({ ...f, price: String(s.testPackagePrice) }))
        }
      }
    } catch (e) {
      console.error('Failed to load PDA test data:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.testCentreId) {
      alert('Please select a test centre.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/pda-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          testDate: form.testDate,
          testTime: form.testTime,
          testCentreId: form.testCentreId,
          price: form.price ? parseFloat(form.price) : undefined,
          notes: undefined, // notes field is used internally for centre data
        }),
      })
      if (res.ok) {
        setForm({ clientId: '', testDate: '', testTime: '', testCentreId: '', price: String(defaultPrice), notes: '' })
        setShowForm(false)
        fetchAll()
      } else {
        const d = await res.json()
        alert(d.error || 'Failed to schedule test.')
      }
    } catch {
      alert('Failed to schedule test.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateResult = async (id: string) => {
    try {
      const res = await fetch(`/api/pda-tests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: editResult }),
      })
      if (res.ok) {
        setEditingId(null)
        setEditResult('')
        fetchAll()
      } else {
        alert('Failed to update result.')
      }
    } catch {
      alert('Failed to update result.')
    }
  }

  // Group centres by region for the dropdown
  const centresByRegion = centres.reduce<Record<string, TestCentre[]>>((acc, c) => {
    const region = c.region || 'Other'
    if (!acc[region]) acc[region] = []
    acc[region].push(c)
    return acc
  }, {})

  const toggleExpand = (id: string) => {
    if (editingId === id) return
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">PDA Tests ({tests.length})</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {showForm ? 'Cancel' : 'Schedule Test'}
          </button>
        </div>

        {/* Schedule Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Schedule PDA Test</h2>
            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                  <select
                    required
                    value={form.clientId}
                    onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select student...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Centre</label>
                  <select
                    required
                    value={form.testCentreId}
                    onChange={e => setForm(f => ({ ...f, testCentreId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select test centre...</option>
                    {Object.entries(centresByRegion).map(([region, regionCentres]) => (
                      <optgroup key={region} label={region}>
                        {regionCentres.map(c => (
                          <option key={c.id} value={c.id}>{c.name} — {c.suburb}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
                  <input
                    type="date"
                    required
                    value={form.testDate}
                    onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Time</label>
                  <input
                    type="time"
                    required
                    value={form.testTime}
                    onChange={e => setForm(f => ({ ...f, testTime: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($)
                    {defaultPrice > 0 && (
                      <span className="ml-1 text-xs text-gray-400 font-normal">default: ${defaultPrice}</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={defaultPrice > 0 ? String(defaultPrice) : '0.00'}
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to use your default test package price. Set to 0 for no charge.</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                Scheduling a PDA test blocks your availability from {form.testTime ? (() => {
                  const [h, m] = form.testTime.split(':').map(Number)
                  const d = new Date(0, 0, 0, h, m - 15)
                  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
                })() : 'before the test'} through 12:45 (2h45 test duration). Your booking buffer applies before and after.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
                  Schedule Test
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tests list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : tests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Car className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-900">No PDA tests scheduled</h3>
            <p className="text-gray-500">Click "Schedule Test" to add your first test</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {tests.map(test => {
                const isExpanded = expandedId === test.id
                const isEditing = editingId === test.id
                const testDate = new Date(test.testDate)

                return (
                  <div key={test.id} className="hover:bg-gray-50 transition">
                    <div
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => !isEditing && toggleExpand(test.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">{resultIcon(test.result)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold truncate text-gray-900">{test.client.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${resultColor(test.result)}`}>
                              {test.result}
                            </span>
                            {test.price > 0 && (
                              <span className="text-xs text-gray-400">${test.price.toFixed(0)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {testDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {test.testTime}
                            </span>
                            <span className="hidden sm:flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {test.testCenterName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isEditing && test.result === 'PENDING' && (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(test.id); setEditResult(test.result); setExpandedId(test.id) }}
                            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                            title="Update result"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {!isEditing && (isExpanded
                          ? <ChevronUp className="h-5 w-5 text-gray-400" />
                          : <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-50 space-y-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <p className="text-sm font-medium text-gray-700">Update Test Result</p>
                            <div className="flex gap-3">
                              <button
                                onClick={() => setEditResult('PASS')}
                                className={`flex-1 px-4 py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition ${
                                  editResult === 'PASS' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-300 text-gray-700'
                                }`}
                              >
                                <CheckCircle className="h-5 w-5" /> Pass
                              </button>
                              <button
                                onClick={() => setEditResult('FAIL')}
                                className={`flex-1 px-4 py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition ${
                                  editResult === 'FAIL' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 hover:border-red-300 text-gray-700'
                                }`}
                              >
                                <XCircle className="h-5 w-5" /> Fail
                              </button>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleUpdateResult(test.id)}
                                disabled={!editResult || editResult === test.result}
                                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold"
                              >
                                <Save className="h-4 w-4" /> Save Result
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditResult('') }}
                                className="flex-1 border px-4 py-2.5 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-2 text-sm"
                              >
                                <X className="h-4 w-4" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-gray-700 mb-2">Student</p>
                              <div className="space-y-1.5 text-gray-600">
                                <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" />{test.client.name}</div>
                                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" />{test.client.phone}</div>
                                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" />{test.client.email}</div>
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-2">Test Centre</p>
                              <div className="space-y-1.5 text-gray-600">
                                <div className="font-medium">{test.testCenterName}</div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                  {test.testCenterAddress}
                                </div>
                                {test.price > 0 && (
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-gray-400" />
                                    ${test.price.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                            {test.result === 'PENDING' && (
                              <div className="sm:col-span-2 pt-2 border-t border-gray-200">
                                <button
                                  onClick={() => { setEditingId(test.id); setEditResult(test.result); }}
                                  className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-semibold"
                                >
                                  <Edit2 className="h-4 w-4" /> Update Result
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
