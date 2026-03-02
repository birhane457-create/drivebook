'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'

interface TimeSlot {
  time: Date
  available: boolean
}

interface BookingCalendarProps {
  instructorId: string
  onSlotSelect?: (date: Date) => void
  selectedDate?: Date
}

export default function BookingCalendar({ 
  instructorId, 
  onSlotSelect,
  selectedDate: initialDate 
}: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date())
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots()
    }
  }, [selectedDate, instructorId])

  const fetchAvailableSlots = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          date: selectedDate.toISOString(),
          lessonDuration: 60
        })
      })

      if (res.ok) {
        const data = await res.json()
        setAvailableSlots(data.slots.map((slot: Date) => 
          new Date(slot).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          })
        ))
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    if (onSlotSelect) {
      onSlotSelect(date)
    }
  }

  const handleSlotSelect = (time: string) => {
    const [hours, minutes] = time.split(':')
    const slotDate = new Date(selectedDate)
    slotDate.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    
    if (onSlotSelect) {
      onSlotSelect(slotDate)
    }
  }

  const goToPreviousWeek = () => {
    setWeekStart(addDays(weekStart, -7))
  }

  const goToNextWeek = () => {
    setWeekStart(addDays(weekStart, 7))
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Select Date & Time</h2>
        <div className="flex gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-6">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const isPast = day < new Date() && !isSameDay(day, new Date())
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => !isPast && handleDateSelect(day)}
              disabled={isPast}
              className={`p-2 sm:p-4 rounded-lg text-center transition ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isPast
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="text-xs sm:text-sm">{format(day, 'EEE')}</div>
              <div className="text-base sm:text-lg font-bold">{format(day, 'd')}</div>
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Available Times
        </h3>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading slots...</div>
        ) : availableSlots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No available slots for this date
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableSlots.map((time) => (
              <button
                key={time}
                onClick={() => handleSlotSelect(time)}
                className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-600 transition"
              >
                {time}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
