'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, CheckCircle, AlertCircle, MapPin, Users, FileCheck, ChevronLeft, ChevronRight } from 'lucide-react'

const slides = [
  {
    id: 'background-check',
    title: 'Verified Instructors',
    description: 'Every instructor is background-checked and fully verified',
    component: 'BackgroundCheckStep'
  },
  {
    id: 'safety-features',
    title: 'In-Lesson Safety',
    description: 'Real-time location tracking and dual-sided controls',
    component: 'SafetyFeaturesStep'
  },
  {
    id: 'ratings-reviews',
    title: 'Transparent Ratings',
    description: 'Honest reviews and ratings from real students',
    component: 'RatingsReviewsStep'
  },
  {
    id: 'assistance',
    title: 'Support Available',
    description: '24/7 customer support for any concerns',
    component: 'AssistanceStep'
  }
]

export default function TrustSafetyShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev: number) => (prev + 1) % slides.length)
    }, 7000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const nextSlide = () => setCurrentIndex((prev: number) => (prev + 1) % slides.length)
  const prevSlide = () => setCurrentIndex((prev: number) => (prev - 1 + slides.length) % slides.length)

  const touchStartX = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX
    if (touchStartX.current - touchEndX > 50) nextSlide()
    if (touchEndX - touchStartX.current > 50) prevSlide()
  }

  const currentSlide = slides[currentIndex]

  return (
    <div className="w-full max-w-7xl mx-auto px-0" inert={true} aria-hidden="true">
      {/* Slide Content */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-2xl overflow-hidden border border-gray-200" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-4 md:p-6">
          <h3 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">{currentSlide.title}</h3>
          <p className="text-green-100 text-sm md:text-lg">{currentSlide.description}</p>
        </div>

        {/* Mockup Content */}
        <div className="p-4 md:p-8 bg-gradient-to-br from-green-50 to-emerald-100 min-h-[400px] md:min-h-[500px]">
          {currentSlide.component === 'BackgroundCheckStep' && <BackgroundCheckStep />}
          {currentSlide.component === 'SafetyFeaturesStep' && <SafetyFeaturesStep />}
          {currentSlide.component === 'RatingsReviewsStep' && <RatingsReviewsStep />}
          {currentSlide.component === 'AssistanceStep' && <AssistanceStep />}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        {/* Slide Indicators */}
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-green-600 w-8' : 'bg-gray-300 w-2'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <button
            onClick={prevSlide}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={nextSlide}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Component placeholders
function BackgroundCheckStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Shield className="w-16 h-16 text-green-600" />
      <p className="text-lg font-semibold text-gray-800">Verified Instructors</p>
    </div>
  )
}

function SafetyFeaturesStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <CheckCircle className="w-16 h-16 text-green-600" />
      <p className="text-lg font-semibold text-gray-800">Real-time Safety Features</p>
    </div>
  )
}

function RatingsReviewsStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <AlertCircle className="w-16 h-16 text-green-600" />
      <p className="text-lg font-semibold text-gray-800">Transparent Ratings</p>
    </div>
  )
}

function AssistanceStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Users className="w-16 h-16 text-green-600" />
      <p className="text-lg font-semibold text-gray-800">24/7 Support Available</p>
    </div>
  )
}

