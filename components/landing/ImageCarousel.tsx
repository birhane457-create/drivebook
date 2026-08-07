'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface Slide {
  id: string
  image: string
  title: string
  description: string
  category?: string
}

interface ImageCarouselProps {
  slides: Slide[]
  autoPlayInterval?: number // milliseconds, default 7000 (7 seconds)
  showControls?: boolean
  showIndicators?: boolean
}

export default function ImageCarousel({
  slides,
  autoPlayInterval = 7000,
  showControls = true,
  showIndicators = true
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length)
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [isAutoPlaying, autoPlayInterval, slides.length])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setIsAutoPlaying(false) // Pause auto-play when user manually navigates
    
    // Resume auto-play after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const goToPrevious = () => {
    const newIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1
    goToSlide(newIndex)
  }

  const goToNext = () => {
    const newIndex = (currentIndex + 1) % slides.length
    goToSlide(newIndex)
  }

  if (slides.length === 0) {
    return <div className="text-center text-gray-500 py-12">No slides available</div>
  }

  const currentSlide = slides[currentIndex]

  return (
    <div className="relative w-full max-w-6xl mx-auto" inert={true} aria-hidden="true">
      {/* Main Slide Container */}
      <div className="relative aspect-[3/2] bg-gray-100 rounded-2xl overflow-hidden shadow-2xl">
        {/* Slide Image */}
        <div className="relative w-full h-full">
          <Image
            src={currentSlide.image}
            alt={currentSlide.title}
            fill
            className="object-cover"
            priority={currentIndex === 0}
          />
          
          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </div>

        {/* Slide Content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          {currentSlide.category && (
            <span className="inline-block bg-purple-600 px-4 py-1 rounded-full text-sm font-semibold mb-3">
              {currentSlide.category}
            </span>
          )}
          <h3 className="text-3xl md:text-4xl font-bold mb-3">{currentSlide.title}</h3>
          <p className="text-lg md:text-xl opacity-90 max-w-3xl">{currentSlide.description}</p>
        </div>

        {/* Navigation Controls */}
        {showControls && slides.length > 1 && (
          <>
            {/* Previous Button */}
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 p-3 rounded-full shadow-lg transition-all hover:scale-110"
              aria-label="Previous slide"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Next Button */}
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 p-3 rounded-full shadow-lg transition-all hover:scale-110"
              aria-label="Next slide"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Auto-play Indicator */}
        {isAutoPlaying && (
          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Auto-playing
          </div>
        )}
      </div>

      {/* Slide Indicators */}
      {showIndicators && slides.length > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(index)}
              className={`transition-all ${
                index === currentIndex
                  ? 'w-12 bg-purple-600'
                  : 'w-3 bg-gray-300 hover:bg-gray-400'
              } h-3 rounded-full`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slide Counter */}
      <div className="text-center mt-4 text-gray-600 text-sm">
        {currentIndex + 1} / {slides.length}
      </div>
    </div>
  )
}

