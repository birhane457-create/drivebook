'use client'

import { useState, useEffect } from 'react'
import { User, Phone, Mail, MapPin, Plus, Search, Edit2, ChevronDown, ChevronUp, Save, X, CalendarPlus, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  phone: string
  email: string
  userId?: string
  addressText?: string
  addressLatitude?: number
  addressLongitude?: number
  notes?: string
  createdAt: string
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
  hasMore: boolean
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
    hasMore: false,
  })
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    addressText: '',
    notes: ''
  })
  const [editData, setEditData] = useState<Client | null>(null)

  useEffect(() => {
    fetchClients(1)
  }, [])

  const fetchClients = async (page: number = 1) => {
    try {
      const res = await fetch(`/api/clients?page=${page}&limit=25`)
      const data = await res.json()
      
      // Check if data has pagination structure
      if (data.pagination) {
        setClients(data.clients)
        setPagination(data.pagination)
      } else if (Array.isArray(data)) {
        // Fallback for old format
        setClients(data)
      } else if (data.error) {
        console.error('API error:', data.error)
        setClients([])
      } else {
        console.error('Unexpected response format:', data)
        setClients([])
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setFormData({ name: '', phone: '', email: '', addressText: '', notes: '' })
        setShowForm(false)
        fetchClients(1)
        alert('Client added successfully!')
      } else {
        const error = await res.json()
        alert(error.details || error.error || 'Failed to create client. Please ensure all required fields are filled.')
      }
    } catch (error) {
      console.error('Failed to create client:', error)
      alert('Failed to create client. Please check your internet connection.')
    }
  }

  const handleEdit = (client: Client) => {
    setEditingId(client.id)
    setEditData({ ...client })
    setExpandedId(client.id)
  }

  const handleSaveEdit = async () => {
    if (!editData) return
    
    try {
      const res = await fetch(`/api/clients/${editData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          phone: editData.phone,
          email: editData.email,
          addressText: editData.addressText,
          notes: editData.notes
        })
      })

      if (res.ok) {
        setEditingId(null)
        setEditData(null)
        fetchClients(pagination.page)
      }
    } catch (error) {
      console.error('Failed to update client:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditData(null)
  }

  const toggleExpand = (id: string) => {
    if (editingId === id) return // Don't collapse while editing
    setExpandedId(expandedId === id ? null : id)
  }

  const filteredClients = Array.isArray(clients) ? clients.filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email.toLowerCase().includes(search.toLowerCase()) ||
    client.phone.includes(search)
  ) : []

  return (
    <div className="max-w-7xl mx-auto py-1 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">Clients ({pagination.total})</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Add Client
          </button>
        </div>

        {showForm && (
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-2 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-slate-100 mb-1">New Client</h2>
            <form onSubmit={handleSubmit} className="space-y-1">
              <div className="grid sm:grid-cols-2 gap-1">
                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.addressText}
                  onChange={(e) => setFormData(prev => ({ ...prev, addressText: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-900 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 order-1 sm:order-2"
                >
                  Add Client
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 h-5 w-5" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-12 text-center">
            <User className="h-16 w-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-slate-100">No clients found</h3>
            <p className="text-slate-400">Add your first client to get started</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-500 overflow-hidden">
            <div className="divide-y divide-slate-500">
              {filteredClients.map((client) => {
                const isExpanded = expandedId === client.id
                const isEditing = editingId === client.id
                const displayClient = isEditing && editData ? editData : client

                return (
                  <div key={client.id} className="hover:bg-slate-800 transition">
                    {/* Compact Row */}
                    <div 
                      className="p-1 cursor-pointer flex items-center justify-between gap-1"
                      onClick={() => !isEditing && toggleExpand(client.id)}
                    >
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-0 flex-wrap">
                            <h3 className="font-semibold truncate text-slate-100">{client.name}</h3>
                            {!client.userId && (
                              <span className="inline-flex items-center gap-1 text-xs bg-amber-950 text-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                <AlertCircle className="h-3 w-3 text-amber-200" />
                                No account
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-200" />
                              {client.phone}
                            </span>
                            <span className="hidden sm:flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 text-slate-400" />
                              {client.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-top gap-0 flex-shrink-0">
                        {!isEditing && (
                          <Link
                            href={`/dashboard/clients/${client.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-slate-900 rounded-lg text-slate-200"
                            title="View Client"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        )}
                        {!isEditing && (
                          <Link
                            href={`/dashboard/bookings/new?clientId=${client.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-slate-900 rounded-lg text-sky-400"
                            title="Book Now"
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </Link>
                        )}
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(client)
                            }}
                            className="p-2 hover:bg-slate-900 rounded-lg text-sky-400"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {!isEditing && (
                          isExpanded ? 
                            <ChevronUp className="h-5 w-5 text-slate-500" /> : 
                            <ChevronDown className="h-5 w-3 text-slate-100" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-slate-900 border-t border-slate-800">
                        {isEditing && editData ? (
                          // Edit Mode
                          <div className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-100 mb-1">Name</label>
                                <input
                                  type="text"
                                  value={editData.name}
                                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                  className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-100 mb-1">Phone</label>
                                <input
                                  type="tel"
                                  value={editData.phone}
                                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                  className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-100 mb-1">
                                Email
                                {client.userId && (
                                  <span className="ml-2 text-xs text-sky-300 font-normal">
                                    (Has user account - cannot edit)
                                  </span>
                                )}
                              </label>
                              <input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                disabled={!!client.userId}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-sky-500 ${
                                  client.userId ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700' : 'bg-slate-950 text-slate-100 border-slate-700'
                                }`}
                                title={client.userId ? 'This client has a user account. They must change their email through account settings.' : ''}
                              />
                              {client.userId && (
                                <p className="text-xs text-slate-500 mt-1">
                                  This client can login and must change their email through their account settings.
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Address</label>
                              <input
                                type="text"
                                value={editData.addressText || ''}
                                onChange={(e) => setEditData({ ...editData, addressText: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Notes</label>
                              <textarea
                                value={editData.notes || ''}
                                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                              >
                                <Save className="h-4 w-4" />
                                Save Changes
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="flex-1 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center justify-center gap-2 text-slate-200"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-300">
                              <Mail className="h-4 w-4 text-slate-500" />
                              <span>{displayClient.email}</span>
                            </div>
                            {displayClient.addressText && (
                              <div className="flex items-start gap-2 text-slate-300">
                                <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                                <span>{displayClient.addressText}</span>
                              </div>
                            )}
                            {displayClient.notes && (
                              <div className="pt-2 border-t border-slate-800">
                                <p className="text-slate-400 italic">{displayClient.notes}</p>
                              </div>
                            )}
                            <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
                              Added {new Date(displayClient.createdAt).toLocaleDateString()}
                            </div>
                            {!client.userId && (
                              <div className="flex items-start gap-2 bg-amber-950 border border-amber-700 rounded-lg p-3 text-sm text-amber-200">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>This client hasn't registered yet. You can still book for them — they'll receive an email to claim their account and complete payment.</span>
                              </div>
                            )}
                            <div className="pt-2">
                              <Link
                                href={`/dashboard/bookings/new?clientId=${client.id}`}
                                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-sm font-medium"
                              >
                                <CalendarPlus className="h-4 w-4" />
                                Book Now
                              </Link>
                            </div>
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

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchClients(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchClients(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
  )
}
