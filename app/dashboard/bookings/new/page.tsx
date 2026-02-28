'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, MapPin } from 'lucide-react'
import BookingFormNew from '@/components/BookingFormNew'

interface Client {
  id: string
  name: string
  phone: string
  email: string
  addressText?: string
  addressLatitude?: number
  addressLongitude?: number
}

export default function NewBookingPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [instructorData, setInstructorData] = useState<any>(null)

  useEffect(() => {
    fetchClients()
    fetchInstructorData()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data)
    } catch (error) {
      console.error('Failed to fetch clients:', error)
    }
  }

  const fetchInstructorData = async () => {
    try {
      const res = await fetch('/api/instructor/profile')
      const data = await res.json()
      if (data && data.id) {
        setInstructorData(data)
      } else {
        console.error('Instructor data missing ID:', data)
      }
    } catch (error) {
      console.error('Failed to fetch instructor data:', error)
    }
  }

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    setSelectedClient(client || null)
    if (client) {
      setShowCalendar(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Bookings
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold">Create New Booking</h1>
          <p className="text-gray-600 mt-2">Select a client and choose an available time slot</p>
        </div>

        {/* Client Selection */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Step 1: Select Client</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Choose Client</label>
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.phone}
                  </option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Selected Client:</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {selectedClient.name}</p>
                  <p><strong>Phone:</strong> {selectedClient.phone}</p>
                  <p><strong>Email:</strong> {selectedClient.email}</p>
                  {selectedClient.addressText && (
                    <p className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{selectedClient.addressText}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-600">
              <p>Don't see your client? <a href="/dashboard/clients" className="text-blue-600 hover:underline">Add a new client first</a></p>
            </div>
          </div>
        </div>

        {/* Booking Calendar */}
        {showCalendar && selectedClient && instructorData?.id && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Step 2: Select Date & Time
            </h2>
            <BookingFormNew
              instructorId={instructorData.id}
              hourlyRate={instructorData.hourlyRate}
              preselectedClient={selectedClient}
              isInstructorBooking={true}
            />
          </div>
        )}

        {showCalendar && (!instructorData || !instructorData.id) && (
          <div className="bg-yellow-50 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading instructor information...</p>
          </div>
        )}

        {!showCalendar && (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Select a client above to see available time slots</p>
          </div>
        )}
      </div>
    </div>
  )
}
