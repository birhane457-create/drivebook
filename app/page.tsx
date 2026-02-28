import Link from 'next/link'
import { Car, Calendar, MapPin, Users, CheckCircle, DollarSign, Clock, Shield, TrendingUp, Smartphone } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900">DriveBook</span>
            </div>
            <div className="flex gap-2 sm:gap-4">
              <Link href="/login" className="text-gray-700 hover:text-blue-600 text-sm sm:text-base px-2 sm:px-0">
                Login
              </Link>
              <Link href="/book" className="hidden sm:inline text-gray-700 hover:text-blue-600">
                For Learners
              </Link>
              <Link href="/register" className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base">
                For Instructors
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
            Your Driving Licence Journey Made Simple
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 max-w-3xl mx-auto px-4">
            Connect with qualified instructors near you. Book lessons instantly. Pass your test with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link 
              href="/book"
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 inline-block w-full sm:w-auto"
            >
              Find Instructors Near You
            </Link>
            <Link 
              href="/register"
              className="bg-green-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-700 inline-block w-full sm:w-auto"
            >
              Join as an Instructor
            </Link>
          </div>
          <div className="max-w-2xl mx-auto text-left space-y-2 text-gray-700">
            <p className="flex items-start gap-2"><span className="text-blue-600 mt-1">🎯</span> Smart booking with real-time availability—no waiting, no phone tag</p>
            <p className="flex items-start gap-2"><span className="text-blue-600 mt-1">📍</span> Location-based matching to find instructors who service your area</p>
            <p className="flex items-start gap-2"><span className="text-blue-600 mt-1">💰</span> Save up to 12% with bulk hour packages and test preparation bundles</p>
            <p className="flex items-start gap-2"><span className="text-blue-600 mt-1">🤖</span> AI voice receptionist available to help you book or reschedule anytime</p>
          </div>
        </div>

        {/* Instructor CTA */}
        <div className="text-center mb-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 sm:p-12 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Are You a Driving Instructor?
          </h2>
          <p className="text-lg mb-6 opacity-90">
            Join our platform and grow your driving school with our all-in-one management system
          </p>
          <Link href="/register" className="bg-white text-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-gray-100 inline-block">
            Start Free Trial
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <Calendar className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Smart Booking</h3>
            <p className="text-gray-600">
              Prevent double bookings with intelligent scheduling and real-time availability.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <MapPin className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Location Based</h3>
            <p className="text-gray-600">
              Find instructors who service your area with our smart location matching.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <Car className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Bulk Packages</h3>
            <p className="text-gray-600">
              Save up to 12% with bulk hour packages and driving test bundles.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <Users className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">24/7 Access</h3>
            <p className="text-gray-600">
              Manage your bookings anytime with your personal dashboard.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

