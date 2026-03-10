'use client'

import { useState, useEffect } from 'react'

export default function PackagePricingShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0)

  const slides = [
    {
      title: 'Pay As You Go',
      subtitle: 'Perfect for trying us out',
      content: (
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto border-2 border-gray-200">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-purple-600 mb-2">$45</div>
            <div className="text-gray-600">per hour</div>
          </div>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">No commitment required</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Book one lesson at a time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Cancel anytime</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Full refund if cancelled 24hrs before</span>
            </li>
          </ul>
          <button className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
            Book Single Lesson
          </button>
        </div>
      )
    },
    {
      title: '5-Hour Package',
      subtitle: 'Save 5% - Most Popular',
      content: (
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto border-2 border-blue-400">
          <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            SAVE 5%
          </div>
          <div className="text-center mb-6">
            <div className="text-gray-400 line-through text-lg">$225</div>
            <div className="text-5xl font-bold text-blue-600 mb-2">$214</div>
            <div className="text-gray-600">$42.80 per hour</div>
          </div>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Save $11 compared to single lessons</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Book lessons as you need them</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Hours never expire</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Priority booking</span>
            </li>
          </ul>
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Buy 5-Hour Package
          </button>
        </div>
      )
    },
    {
      title: '10-Hour Package',
      subtitle: 'Save 8% - Best Value',
      content: (
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto border-2 border-green-400">
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            SAVE 8%
          </div>
          <div className="text-center mb-6">
            <div className="text-gray-400 line-through text-lg">$450</div>
            <div className="text-5xl font-bold text-green-600 mb-2">$414</div>
            <div className="text-gray-600">$41.40 per hour</div>
          </div>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Save $36 compared to single lessons</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Perfect for test preparation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Hours never expire</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Priority booking + free mock test</span>
            </li>
          </ul>
          <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
            Buy 10-Hour Package
          </button>
        </div>
      )
    },
    {
      title: '20-Hour Package',
      subtitle: 'Save 12% - Complete Course',
      content: (
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto border-2 border-amber-400">
          <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            SAVE 12%
          </div>
          <div className="text-center mb-6">
            <div className="text-gray-400 line-through text-lg">$900</div>
            <div className="text-5xl font-bold text-amber-600 mb-2">$792</div>
            <div className="text-gray-600">$39.60 per hour</div>
          </div>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Save $108 compared to single lessons</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Complete beginner to test-ready</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Hours never expire</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span className="text-gray-700">Priority booking + 2 free mock tests</span>
            </li>
          </ul>
          <button className="w-full bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors">
            Buy 20-Hour Package
          </button>
        </div>
      )
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [slides.length])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 shadow-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{slides[currentSlide].title}</h3>
        <p className="text-gray-600">{slides[currentSlide].subtitle}</p>
      </div>

      {/* Slide Content */}
      <div className="relative min-h-[500px] flex items-center justify-center">
        {slides[currentSlide].content}
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg transition-all hover:scale-110"
        aria-label="Previous slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-3 shadow-lg transition-all hover:scale-110"
        aria-label="Next slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots Navigation */}
      <div className="flex justify-center gap-2 mt-6">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentSlide ? 'bg-purple-600 w-8' : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Slide Counter */}
      <div className="text-center mt-4 text-sm text-gray-500">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  )
}
