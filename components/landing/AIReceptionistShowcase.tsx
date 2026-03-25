'use client'

import { useState, useEffect } from 'react'
import { Phone, MessageSquare, Calendar, CheckCircle, Clock } from 'lucide-react'

const VOICE_NUMBER = process.env.NEXT_PUBLIC_VOICE_PHONE_NUMBER || '+1 (708) 933-5601'

const slides = [
  {
    id: 'call',
    title: 'Call Anytime - AI Answers 24/7',
    description: 'Our AI receptionist handles calls, checks availability, and books lessons instantly',
    component: 'CallStep'
  },
  {
    id: 'conversation',
    title: 'Natural Conversation Flow',
    description: 'AI understands your needs and guides you through booking',
    component: 'ConversationStep'
  },
  {
    id: 'confirmation',
    title: 'Instant Confirmation',
    description: 'Get SMS confirmation and calendar invite immediately',
    component: 'ConfirmationStep'
  }
]

export default function AIReceptionistShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const currentSlide = slides[currentIndex]

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6">
          <h3 className="text-3xl font-bold mb-2">{currentSlide.title}</h3>
          <p className="text-purple-100 text-lg">{currentSlide.description}</p>
        </div>

        <div className="p-8 bg-gradient-to-br from-purple-50 to-indigo-100 min-h-[500px]">
          {currentSlide.component === 'CallStep' && <CallStep />}
          {currentSlide.component === 'ConversationStep' && <ConversationStep />}
          {currentSlide.component === 'ConfirmationStep' && <ConfirmationStep />}
        </div>
      </div>

      <div className="flex justify-center gap-3 mt-6">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(index)}
            className={`transition-all rounded-full ${
              index === currentIndex ? 'w-12 h-3 bg-purple-600' : 'w-3 h-3 bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>
      <div className="text-center mt-4 text-gray-600 text-sm">
        {currentIndex + 1} of {slides.length}
      </div>
    </div>
  )
}

function CallStep() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h4 className="text-2xl font-bold text-gray-900 mb-4">Prefer to Call?</h4>
          <ul className="space-y-2 md:space-y-3 mb-6">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700"><strong>Instant answers</strong> to your questions about lessons and pricing</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700"><strong>Real-time availability</strong> check while on the call</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700"><strong>SMS confirmation</strong> sent to your phone immediately</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700"><strong>No app download</strong> required - just call and book</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center border-2 border-purple-200">
          <p className="text-sm uppercase tracking-wide text-purple-600 font-semibold mb-3">
            Prefer to call? Available 24/7
          </p>
          <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-12 h-12 text-white" />
          </div>
          <a
            href={`tel:${VOICE_NUMBER}`}
            className="inline-block bg-purple-600 text-white px-8 py-4 rounded-xl no-underline font-bold text-2xl hover:bg-purple-700 transition-all shadow-lg mb-4"
          >
            {VOICE_NUMBER}
          </a>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
            <Clock className="w-4 h-4" />
            <span>Available 24/7</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              Our AI assistant will help you find an instructor, check availability, and book your lesson - all in one call.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConversationStep() {
  const messages = [
    { type: 'user', text: 'Hi, I\'d like to book a driving lesson' },
    { type: 'ai', text: 'Hello! I\'d be happy to help you book a lesson. What\'s your location?' },
    { type: 'user', text: 'I\'m in Maylands, postcode 6051' },
    { type: 'ai', text: 'Great! I found 3 instructors who service Maylands. Would you prefer manual or automatic?' },
    { type: 'user', text: 'Automatic please' },
    { type: 'ai', text: 'Perfect! Sarah J. has availability this week. She has a 4.9 rating and charges $45/hour. Would you like to book with her?' },
    { type: 'user', text: 'Yes, that sounds good' },
    { type: 'ai', text: 'Excellent! What day and time works best for you?' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">DriveBook AI Assistant</h4>
            <p className="text-sm text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Online
            </p>
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-4 py-2 rounded-2xl ${
                msg.type === 'user' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConfirmationStep() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h4 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h4>
          <p className="text-gray-600">Your lesson has been successfully booked</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Date & Time</p>
                <p className="font-semibold text-gray-900">Thursday, March 14, 2026 at 2:00 PM</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">S</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Instructor</p>
                <p className="font-semibold text-gray-900">Sarah J.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-semibold text-gray-900">1 hour - $45</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-6">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">SMS Sent!</p>
              <p className="text-sm text-blue-800">
                Confirmation sent to your phone with lesson details and instructor contact information.
              </p>
            </div>
          </div>
        </div>

        <button className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
          Add to Calendar
        </button>
      </div>
    </div>
  )
}
