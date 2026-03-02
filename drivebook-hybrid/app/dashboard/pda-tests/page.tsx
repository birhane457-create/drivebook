'use client'

import { useState, useEffect } from 'react'
import { Car, Calendar, MapPin, Plus, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Edit2, Save, X } from 'lucide-react'

interface PDATest {
  id: string
  testDate: string
  testTime: string
  testCenterName: string
  testCenterAddress: string
  result: string
  notes?: string
  client: {
    name: string
    phone: string
    email: string
  }
}

export default function PDATestsPage() {
  const [tests, setTests] = useState<PDATest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editResult, setEditResult] = useState<string>('')

  useEffect(() => {
    fetchTests()
  }, [])

  const fetchTests = async () => {
    try {
      const res = await fetch('/api/pda-tests')
      if (res.ok) {
        const data = await res.json()
        setTests(data)
      }
    } catch (error) {
      console.error('Failed to fetch PDA tests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateResult = async (id: string) => {
    try {
      const res = await fetch(`/api/pda-tests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: editResult })
      })

      if (res.ok) {
        setEditingId(null)
        setEditResult('')
        fetchTests()
      }
    } catch (error) {
      console.error('Failed to update result:', error)
    }
  }

  const startEdit = (test: PDATest) => {
    setEditingId(test.id)
    setEditResult(test.result)
    setExpandedId(test.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditResult('')
  }

  const toggleExpand = (id: string) => {
    if (editingId === id) return
    setExpandedId(expandedId === id ? null : id)
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'PASS':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'FAIL':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />
    }
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'PASS': return 'bg-green-100 text-green-800'
      case 'FAIL': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">PDA Tests ({tests.length})</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Schedule Test
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : tests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No PDA tests scheduled</h3>
            <p className="text-gray-600">Schedule your first test to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y">
              {tests.map((test) => {
                const isExpanded = expandedId === test.id
                const isEditing = editingId === test.id
                const testDate = new Date(test.testDate)

                return (
                  <div key={test.id} className="hover:bg-gray-50 transition">
                    {/* Compact Row */}
                    <div 
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => !isEditing && toggleExpand(test.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {getResultIcon(test.result)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{test.client.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${getResultColor(test.result)}`}>
                              {test.result}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {testDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {test.testTime}
                            </span>
                            <span className="hidden sm:inline truncate">
                              {test.testCenterName}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isEditing && test.result === 'PENDING' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(test)
                            }}
                            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {!isEditing && (
                          isExpanded ? 
                            <ChevronUp className="h-5 w-5 text-gray-400" /> : 
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-gray-50">
                        {isEditing ? (
                          // Edit Mode
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Update Test Result</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditResult('PASS')}
                                  className={`flex-1 px-4 py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                                    editResult === 'PASS' 
                                      ? 'border-green-600 bg-green-50 text-green-700' 
                                      : 'border-gray-200 hover:border-green-300'
                                  }`}
                                >
                                  <CheckCircle className="h-5 w-5" />
                                  Pass
                                </button>
                                <button
                                  onClick={() => setEditResult('FAIL')}
                                  className={`flex-1 px-4 py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                                    editResult === 'FAIL' 
                                      ? 'border-red-600 bg-red-50 text-red-700' 
                                      : 'border-gray-200 hover:border-red-300'
                                  }`}
                                >
                                  <XCircle className="h-5 w-5" />
                                  Fail
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateResult(test.id)}
                                disabled={!editResult || editResult === test.result}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                <Save className="h-4 w-4" />
                                Save Result
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-2"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Student Details</h4>
                                <div className="space-y-2 text-gray-600">
                                  <div>{test.client.name}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">📞</span>
                                    {test.client.phone}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs">✉️</span>
                                    {test.client.email}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Test Details</h4>
                                <div className="space-y-2 text-gray-600">
                                  <div>
                                    <span className="font-medium">Date:</span> {testDate.toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </div>
                                  <div>
                                    <span className="font-medium">Time:</span> {test.testTime}
                                  </div>
                                  <div>
                                    <span className="font-medium">Result:</span>{' '}
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${getResultColor(test.result)}`}>
                                      {test.result}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Test Center</h4>
                              <div className="space-y-2 text-sm text-gray-600">
                                <div className="font-medium">{test.testCenterName}</div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 mt-0.5" />
                                  {test.testCenterAddress}
                                </div>
                              </div>
                            </div>

                            {test.notes && (
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Notes</h4>
                                <p className="text-sm text-gray-600 italic">{test.notes}</p>
                              </div>
                            )}

                            {test.result === 'PENDING' && (
                              <div className="pt-2 border-t">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEdit(test)
                                  }}
                                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                >
                                  <Edit2 className="h-4 w-4" />
                                  Update Result
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
