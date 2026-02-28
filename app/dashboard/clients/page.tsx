'use client'

import { useState, useEffect } from 'react'
import { User, Phone, Mail, MapPin, Plus, Search, Edit2, ChevronDown, ChevronUp, Save, X } from 'lucide-react'

interface Client {
  id: string
  name: string
  phone: string
  email: string
  addressText?: string
  notes?: string
  createdAt: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
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
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data)
    } catch (error) {
      console.error('Failed to fetch clients:', error)
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
        fetchClients()
      }
    } catch (error) {
      console.error('Failed to create client:', error)
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
        fetchClients()
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

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email.toLowerCase().includes(search.toLowerCase()) ||
    client.phone.includes(search)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Clients ({clients.length})</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Add Client
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4">New Client</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={formData.addressText}
                  onChange={(e) => setFormData(prev => ({ ...prev, addressText: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 order-2 sm:order-1"
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

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No clients found</h3>
            <p className="text-gray-600">Add your first client to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y">
              {filteredClients.map((client) => {
                const isExpanded = expandedId === client.id
                const isEditing = editingId === client.id
                const displayClient = isEditing && editData ? editData : client

                return (
                  <div key={client.id} className="hover:bg-gray-50 transition">
                    {/* Compact Row */}
                    <div 
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => !isEditing && toggleExpand(client.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{client.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </span>
                            <span className="hidden sm:flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(client)
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
                        {isEditing && editData ? (
                          // Edit Mode
                          <div className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                  type="text"
                                  value={editData.name}
                                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input
                                  type="tel"
                                  value={editData.phone}
                                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Email</label>
                              <input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Address</label>
                              <input
                                type="text"
                                value={editData.addressText || ''}
                                onChange={(e) => setEditData({ ...editData, addressText: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Notes</label>
                              <textarea
                                value={editData.notes || ''}
                                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
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
                                className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-2"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span>{displayClient.email}</span>
                            </div>
                            {displayClient.addressText && (
                              <div className="flex items-start gap-2 text-gray-700">
                                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                                <span>{displayClient.addressText}</span>
                              </div>
                            )}
                            {displayClient.notes && (
                              <div className="pt-2 border-t">
                                <p className="text-gray-600 italic">{displayClient.notes}</p>
                              </div>
                            )}
                            <div className="pt-2 border-t text-xs text-gray-500">
                              Added {new Date(displayClient.createdAt).toLocaleDateString()}
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
      </div>
    </div>
  )
}
