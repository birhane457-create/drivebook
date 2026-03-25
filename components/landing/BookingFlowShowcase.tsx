'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, Search, Star, DollarSign, Car, Calendar, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

const slides = [
  {
    id: 'search',
    title: '1. Search Your Area',
    description: 'Enter your suburb, postcode, or full address to find instructors',
    component: 'SearchStep'
  },
  {
    id: 'results',
    title: '2. View Available Instructors',
    description: 'See profiles, ratings, and hourly rates of instructors in your area',
    component: 'ResultsStep'
  },
  {
    id: 'profile',
    title: '3. Choose Package & Book',
    description: 'Select your package, pick a time, and complete booking instantly',
    component: 'ProfileStep'
  },
  {
    id: 'payment',
    title: '4. Secure Payment',
    description: 'Pay securely with credit card or wallet balance',
    component: 'PaymentStep'
  },
  {
    id: 'confirmation',
    title: '5. Booking Confirmed!',
    description: 'Get instant SMS confirmation and calendar invite',
    component: 'ConfirmationStep'
  }
]

export default function BookingFlowShowcase() {
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
    <div className="w-full max-w-7xl mx-auto px-0">
      {/* Slide Content */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-2xl overflow-hidden border border-gray-200" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 md:p-6">
          <h3 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">{currentSlide.title}</h3>
          <p className="text-blue-100 text-sm md:text-lg">{currentSlide.description}</p>
        </div>

        {/* Mockup Content */}
        <div className="p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-[400px] md:min-h-[500px]">
          {currentSlide.component === 'SearchStep' && <SearchStep />}
          {currentSlide.component === 'ResultsStep' && <ResultsStep />}
          {currentSlide.component === 'ProfileStep' && <ProfileStep />}
          {currentSlide.component === 'PaymentStep' && <PaymentStep />}
          {currentSlide.component === 'ConfirmationStep' && <ConfirmationStep />}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col items-center gap-3 mt-6 md:mt-8">
        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 md:gap-3">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(index)}
              className={`transition-all rounded-full ${
                index === currentIndex
                  ? 'w-10 md:w-12 h-2.5 md:h-3 bg-blue-600'
                  : 'w-2.5 md:w-3 h-2.5 md:h-3 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Counter & Arrow Navigation */}
        <div className="flex items-center justify-center gap-4 md:gap-6">
          <button onClick={prevSlide} className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden" aria-label="Previous slide">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center text-gray-600 text-xs md:text-sm whitespace-nowrap">
            Step {currentIndex + 1} of {slides.length}
          </div>
          <button onClick={nextSlide} className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden" aria-label="Next slide">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Step 1: Search Component
function SearchStep() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 md:h-5 w-4 md:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Enter suburb or postcode..."
              className="w-full pl-10 pr-4 py-2.5 md:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-base md:text-lg"
              defaultValue=""
            />
          </div>
          <button className="bg-blue-600 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2 w-full md:w-auto">
            <Search className="h-4 md:h-5 w-4 md:w-5" />
            Search
          </button>
        </div>
        <p className="text-xs md:text-sm text-gray-500 mt-3">
          Example: "Maylands WA", "6051"
        </p>
      </div>

      {/* Features Below */}
      <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow p-3 md:p-4 text-center">
          <div className="w-10 md:w-12 h-10 md:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
            <Search className="w-5 md:w-6 h-5 md:h-6 text-blue-600" />
          </div>
          <h4 className="font-semibold mb-1 text-sm md:text-base">Search by Location</h4>
          <p className="text-xs md:text-sm text-gray-600">Find instructors in your area</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 md:p-4 text-center">
          <div className="w-10 md:w-12 h-10 md:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
            <Star className="w-5 md:w-6 h-5 md:h-6 text-green-600" />
          </div>
          <h4 className="font-semibold mb-1 text-sm md:text-base">View Profiles</h4>
          <p className="text-xs md:text-sm text-gray-600">Check ratings and reviews</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 md:p-4 text-center">
          <div className="w-10 md:w-12 h-10 md:h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
            <Calendar className="w-5 md:w-6 h-5 md:h-6 text-purple-600" />
          </div>
          <h4 className="font-semibold mb-1 text-sm md:text-base">Book Instantly</h4>
          <p className="text-xs md:text-sm text-gray-600">Choose time and confirm</p>
        </div>
      </div>
    </div>
  )
}

// Step 2: Results Component
function ResultsStep() {
  const instructors = [
    { name: 'Sarah J.', trait: 'female, friendly', rate: 45, rating: 4.9 },
    { name: 'Mike T.', trait: 'male, confident', rate: 48, rating: 4.8 },
    { name: 'Chloe R.', trait: 'female, patient', rate: 42, rating: 5.0 }
  ]

  return (
    <div>
      <div className="text-center mb-4 md:mb-6">
        <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
          Instructors Near You
        </h3>
        <p className="text-xs md:text-base text-gray-600">
          Showing instructors who service: <span className="font-semibold">Maylands WA</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
        {instructors.map((instructor, idx) => (
          <div key={idx} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            {/* Profile Image Placeholder */}
            <div className="h-32 md:h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <div className="w-16 md:w-24 h-16 md:h-24 bg-white rounded-full flex items-center justify-center">
                <span className="text-2xl md:text-4xl font-bold text-gray-400">{instructor.name.charAt(0)}</span>
              </div>
            </div>
            
            {/* Card Content */}
            <div className="p-3 md:p-4">
              <h4 className="text-base md:text-xl font-bold text-gray-900 mb-0.5 md:mb-1">{instructor.name}</h4>
              <p className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3">{instructor.trait}</p>
              
              <div className="flex items-center gap-1 mb-2 md:mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 md:h-4 w-3 md:w-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-1 text-xs md:text-sm text-gray-600">({instructor.rating})</span>
              </div>

              <div className="flex items-center gap-2 mb-2 md:mb-3 text-green-600 font-semibold text-sm md:text-base">
                <DollarSign className="h-4 md:h-5 w-4 md:w-5" />
                <span>${instructor.rate}/hour</span>
              </div>

              <div className="flex items-center gap-2 mb-3 md:mb-4 text-xs md:text-sm text-gray-600">
                <Car className="h-3 md:h-4 w-3 md:w-4" />
                <span>Manual, Automatic</span>
              </div>

              <button className="w-full bg-blue-600 text-white py-2 md:py-2.5 rounded-lg font-semibold text-sm md:text-base hover:bg-blue-700 transition-colors">
                Book Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Step 3: Profile & Booking Component
function ProfileStep() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 max-w-7xl mx-auto">
      {/* Left: Instructor Profile */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          {/* Profile Image */}
          <div className="text-center mb-3 md:mb-4">
            <div className="w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full mx-auto flex items-center justify-center mb-2 md:mb-3">
              <span className="text-2xl md:text-4xl font-bold text-gray-400">S</span>
            </div>
            <h3 className="text-lg md:text-2xl font-bold">Sarah J.</h3>
            <div className="flex items-center justify-center gap-1 mt-1 md:mt-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 md:h-5 w-4 md:w-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-1 text-xs md:text-sm text-gray-600">(4.9)</span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 md:space-y-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 md:h-5 w-4 md:w-5 text-gray-400" />
              <span className="font-semibold text-green-600 text-sm md:text-base">$45/hour</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-4 md:h-5 w-4 md:w-5 text-gray-400" />
              <span className="text-xs md:text-sm">Manual, Automatic</span>
            </div>
          </div>

          {/* Service Areas */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm md:text-base">
              <MapPin className="h-4 md:h-5 w-4 md:w-5" />
              Service Areas
            </h4>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {['6051', '6052', '6053'].map((code) => (
                <span key={code} className="px-2.5 py-1 bg-green-500 text-white rounded-full text-xs md:text-sm">
                  {code}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Booking Form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <h3 className="text-lg md:text-2xl font-bold mb-1 md:mb-2 flex items-center gap-2">
            <Calendar className="h-5 md:h-6 w-5 md:w-6 text-blue-600" />
            Book Your Lessons
          </h3>
          <p className="text-xs md:text-base text-gray-600 mb-4 md:mb-6">
            Choose a package and save up to 12% on bulk bookings
          </p>

          {/* Package Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
            {[
              { hours: 1, price: 45, save: 0 },
              { hours: 5, price: 43, save: 4 },
              { hours: 10, price: 42, save: 7 },
              { hours: 20, price: 40, save: 12 }
            ].map((pkg) => (
              <div key={pkg.hours} className="border-2 border-gray-200 rounded-lg p-3 md:p-4 hover:border-blue-500 cursor-pointer transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-base md:text-lg">{pkg.hours} Hour{pkg.hours > 1 ? 's' : ''}</h4>
                    <p className="text-xs md:text-sm text-gray-600">${pkg.price}/hour</p>
                  </div>
                  {pkg.save > 0 && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-semibold">
                      Save {pkg.save}%
                    </span>
                  )}
                </div>
                <div className="text-lg md:text-xl font-bold text-blue-600">
                  ${pkg.price * pkg.hours}
                </div>
              </div>
            ))}
          </div>

          <button className="w-full bg-blue-600 text-white py-3 md:py-4 rounded-lg font-bold text-base md:text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            Continue to Payment
            <ArrowRight className="h-4 md:h-5 w-4 md:w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Step 4: Payment Component
function PaymentStep() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg md:shadow-xl p-4 md:p-8">
        <h3 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">Complete Your Payment</h3>
        
        {/* Order Summary */}
        <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
          <h4 className="font-semibold mb-3 text-sm md:text-base">Order Summary</h4>
          <div className="space-y-2 text-xs md:text-sm">
            <div className="flex justify-between">
              <span>10-Hour Package with Sarah J.</span>
              <span className="font-semibold">$420</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Discount (8% off)</span>
              <span className="font-semibold">-$36</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-base md:text-lg font-bold">
              <span>Total</span>
              <span className="text-blue-600">$414</span>
            </div>
          </div>
        </div>

        {/* Payment Method Tabs */}
        <div className="flex gap-2 mb-4 md:mb-6">
          <button className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold text-sm md:text-base">
            Credit Card
          </button>
          <button className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 text-sm md:text-base">
            Wallet Balance
          </button>
        </div>

        {/* Card Form */}
        <div className="space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1">Card Number</label>
            <div className="relative">
              <input
                type="text"
                placeholder="4242 4242 4242 4242"
                className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                <div className="w-8 h-5 bg-blue-600 rounded"></div>
                <div className="w-8 h-5 bg-red-600 rounded"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Expiry Date</label>
              <input
                type="text"
                placeholder="MM / YY"
                className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">CVV</label>
              <input
                type="text"
                placeholder="123"
                className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium mb-1">Cardholder Name</label>
            <input
              type="text"
              placeholder="John Smith"
              className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
            />
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 mt-4 md:mt-6 text-xs md:text-sm text-gray-600">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="hidden md:inline">Secured by Stripe • Your payment info is encrypted</span>
          <span className="md:hidden">Secured by Stripe</span>
        </div>

        <button className="w-full bg-blue-600 text-white py-3 md:py-4 rounded-lg font-bold text-base md:text-lg hover:bg-blue-700 transition-colors mt-4 md:mt-6">
          Pay $414 Now
        </button>
      </div>
    </div>
  )
}

// Step 5: Confirmation Component
function ConfirmationStep() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg md:shadow-xl p-4 md:p-8 text-center">
        {/* Success Icon */}
        <div className="w-16 md:w-20 h-16 md:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <svg className="w-9 md:w-12 h-9 md:h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Booking Confirmed!</h3>
        <p className="text-xs md:text-base text-gray-600 mb-4 md:mb-8">Your payment was successful and lessons are ready to schedule</p>

        {/* Booking Details */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 md:p-6 mb-4 md:mb-6 text-left">
          <h4 className="font-bold text-base md:text-lg mb-3 md:mb-4">Booking Details</h4>
          <div className="space-y-2 md:space-y-3 text-sm md:text-base">
            <div className="flex justify-between">
              <span className="text-gray-600">Instructor:</span>
              <span className="font-semibold">Sarah J.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Package:</span>
              <span className="font-semibold">10 Hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold text-green-600">$414</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Booking ID:</span>
              <span className="font-mono text-xs md:text-sm">#BK-2026-0310</span>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 md:p-6 mb-4 md:mb-6 text-left">
          <h4 className="font-bold text-base md:text-lg mb-2 md:mb-3 flex items-center gap-2">
            <span className="text-xl md:text-2xl">📱</span>
            What Happens Next?
          </h4>
          <ul className="space-y-2 text-xs md:text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>SMS confirmation sent to your phone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>Email receipt sent to your inbox</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>10 hours added to your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">→</span>
              <span>Schedule your first lesson from your dashboard</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button className="w-full bg-blue-600 text-white py-2.5 md:py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-blue-700 transition-colors">
            Go to Dashboard
          </button>
          <button className="w-full bg-gray-200 text-gray-700 py-2.5 md:py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-gray-300 transition-colors">
            Schedule First Lesson
          </button>
        </div>
      </div>
    </div>
  )
}
