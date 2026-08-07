'use client'

import { useState, useEffect, useRef } from 'react'
import { TrendingUp, Target, Award, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'

const slides = [
  {
    id: 'dashboard',
    title: 'Your Performance Dashboard',
    description: 'See your overall score and progress at a glance',
    component: 'DashboardStep'
  },
  {
    id: 'categories',
    title: 'Category Breakdown',
    description: 'Track your performance across 8 key driving skills',
    component: 'CategoriesStep'
  },
  {
    id: 'progress',
    title: 'Progress Over Time',
    description: 'Watch your skills improve from first lesson to test day',
    component: 'ProgressStep'
  }
]

export default function ProgressTrackingShowcase() {
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

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length)

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
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-2xl overflow-hidden border border-gray-200" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="bg-gradient-to-r from-indigo-600 to-purple-800 text-white p-4 md:p-6">
          <h3 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">{currentSlide.title}</h3>
          <p className="text-indigo-100 text-sm md:text-lg">{currentSlide.description}</p>
        </div>

        <div className="p-4 md:p-8 bg-gradient-to-br from-indigo-50 to-purple-100 min-h-[400px] md:min-h-[500px]">
          {currentSlide.component === 'DashboardStep' && <DashboardStep />}
          {currentSlide.component === 'CategoriesStep' && <CategoriesStep />}
          {currentSlide.component === 'ProgressStep' && <ProgressStep />}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col items-center gap-3 mt-6 md:mt-8">
        <div className="flex justify-center gap-2 md:gap-3">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(index)}
              className={`transition-all rounded-full ${
                index === currentIndex ? 'w-10 md:w-12 h-2.5 md:h-3 bg-indigo-600' : 'w-2.5 md:w-3 h-2.5 md:h-3 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 md:gap-6">
          <button onClick={prevSlide} className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden" aria-label="Previous slide">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center text-gray-600 text-xs md:text-sm whitespace-nowrap">
            {currentIndex + 1} / {slides.length}
          </div>
          <button onClick={nextSlide} className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden" aria-label="Next slide">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

function DashboardStep() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 md:p-8 rounded-lg md:rounded-2xl shadow-lg md:shadow-xl mb-4 md:mb-6">
        <div className="text-center">
          <div className="text-5xl md:text-7xl font-bold mb-1 md:mb-2">85</div>
          <div className="text-lg md:text-2xl mb-3 md:mb-4">Overall Score</div>
          <div className="inline-block bg-green-500 px-4 md:px-6 py-1.5 md:py-2 rounded-full font-semibold text-sm md:text-lg">
            ✓ Test Ready!
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-center">
          <div className="w-12 md:w-16 h-12 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
            <BarChart3 className="w-6 md:w-8 h-6 md:h-8 text-blue-600" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-0.5 md:mb-1">12</div>
          <div className="text-xs md:text-sm text-gray-600">Lessons Completed</div>
        </div>

        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-center">
          <div className="w-12 md:w-16 h-12 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
            <TrendingUp className="w-6 md:w-8 h-6 md:h-8 text-green-600" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-0.5 md:mb-1">+25</div>
          <div className="text-xs md:text-sm text-gray-600">Points Improved</div>
        </div>

        <div className="bg-white rounded-lg md:rounded-xl shadow-lg p-4 md:p-6 text-center">
          <div className="w-12 md:w-16 h-12 md:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
            <Target className="w-6 md:w-8 h-6 md:h-8 text-purple-600" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-0.5 md:mb-1">3</div>
          <div className="text-xs md:text-sm text-gray-600">Areas to Focus</div>
        </div>
      </div>
    </div>
  )
}

function CategoriesStep() {
  const categories = [
    { name: 'Signal', score: 90, color: 'bg-green-500' },
    { name: 'Look Behind', score: 85, color: 'bg-green-500' },
    { name: 'Movement', score: 80, color: 'bg-green-500' },
    { name: 'Path', score: 88, color: 'bg-green-500' },
    { name: 'Vehicle Management', score: 75, color: 'bg-yellow-500' },
    { name: 'Responsiveness', score: 92, color: 'bg-green-500' },
    { name: 'Flow', score: 78, color: 'bg-yellow-500' },
    { name: 'Overall', score: 85, color: 'bg-green-500' }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg md:rounded-2xl shadow-lg md:shadow-xl p-4 md:p-8">
        <h4 className="text-lg md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Performance by Category</h4>
        
        <div className="space-y-3 md:space-y-4">
          {categories.map((cat, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <span className="font-semibold text-xs md:text-base text-gray-900 flex-1 truncate">{cat.name}</span>
                <span className="text-lg md:text-2xl font-bold text-gray-900 ml-2 flex-shrink-0">{cat.score}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 md:h-3">
                <div 
                  className={`${cat.color} h-2 md:h-3 rounded-full transition-all duration-500`}
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 md:mt-8 bg-amber-50 border-l-4 border-amber-500 p-3 md:p-4 rounded">
          <h5 className="font-semibold text-amber-900 mb-1.5 md:mb-2 text-sm md:text-base">💡 Areas to Focus On</h5>
          <ul className="text-xs md:text-sm text-amber-800 space-y-0.5 md:space-y-1">
            <li>• <strong>Vehicle Management (75)</strong> - Practice smooth gear changes</li>
            <li>• <strong>Flow (78)</strong> - Work on coordinating all skills together</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function ProgressStep() {
  const lessons = [
    { lesson: 1, score: 60 },
    { lesson: 2, score: 62 },
    { lesson: 3, score: 65 },
    { lesson: 4, score: 68 },
    { lesson: 5, score: 70 },
    { lesson: 6, score: 73 },
    { lesson: 7, score: 75 },
    { lesson: 8, score: 78 },
    { lesson: 9, score: 80 },
    { lesson: 10, score: 82 },
    { lesson: 11, score: 84 },
    { lesson: 12, score: 85 }
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg md:rounded-2xl shadow-lg md:shadow-xl p-4 md:p-8">
        <h4 className="text-lg md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Your Journey to Test Ready</h4>
        
        {/* Graph */}
        <div className="relative h-48 md:h-64 mb-6 md:mb-8">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs md:text-sm text-gray-600">
            <span>100</span>
            <span>80</span>
            <span>60</span>
            <span>40</span>
            <span>20</span>
            <span>0</span>
          </div>

          {/* Test Ready Line */}
          <div className="absolute left-8 md:left-12 right-0 bg-green-200 h-px" style={{ top: '20%' }}>
            <span className="absolute -top-4 md:-top-6 right-0 text-xs text-green-600 font-semibold">Test Ready (80+)</span>
          </div>

          {/* Graph area */}
          <div className="absolute left-8 md:left-12 right-0 top-0 bottom-0 border-l-2 border-b-2 border-gray-300">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={lessons.map((l, i) => `${(i / (lessons.length - 1)) * 100},${100 - l.score}`).join(' ')}
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>

            {/* Data points */}
            {lessons.map((l, i) => (
              <div
                key={i}
                className="absolute w-2 md:w-3 h-2 md:h-3 bg-purple-600 rounded-full border-2 border-white shadow-lg"
                style={{
                  left: `${(i / (lessons.length - 1)) * 100}%`,
                  top: `${100 - l.score}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`Lesson ${l.lesson}: ${l.score}`}
              />
            ))}
          </div>

          {/* X-axis labels */}
          <div className="absolute left-8 md:left-12 right-0 -bottom-4 md:-bottom-6 flex justify-between text-xs text-gray-600">
            <span>L1</span>
            <span>L6</span>
            <span>L12</span>
          </div>
        </div>

        {/* Milestones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 md:p-4 rounded">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 md:w-2 h-1.5 md:h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs md:text-sm font-semibold text-blue-900">Lesson 1</span>
            </div>
            <p className="text-xs text-blue-800">Started journey - Score: 60</p>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-3 md:p-4 rounded">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 md:w-2 h-1.5 md:h-2 bg-purple-500 rounded-full"></div>
              <span className="text-xs md:text-sm font-semibold text-purple-900">Lesson 6</span>
            </div>
            <p className="text-xs text-purple-800">Parallel parking mastered</p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-3 md:p-4 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-3 md:w-4 h-3 md:h-4 text-green-600" />
              <span className="text-xs md:text-sm font-semibold text-green-900">Lesson 12</span>
            </div>
            <p className="text-xs text-green-800">Test Ready! Score: 85</p>
          </div>
        </div>
      </div>
    </div>
  )
}

