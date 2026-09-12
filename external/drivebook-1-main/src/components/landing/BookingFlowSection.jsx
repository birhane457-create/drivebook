import React, { useState, useEffect, useRef } from 'react';
import { Search, Star, MapPin, ChevronLeft, ChevronRight, CheckCircle, CreditCard, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
  { id: 'search',       title: '1. Search Your Area',            desc: 'Enter your suburb, postcode, or full address to find instructors' },
  { id: 'results',      title: '2. View Available Instructors',  desc: 'See profiles, ratings, and hourly rates of instructors in your area' },
  { id: 'profile',      title: '3. Choose Package & Book',       desc: 'Select your package, pick a time, and complete booking instantly' },
  { id: 'payment',      title: '4. Secure Payment',              desc: 'Pay securely with credit card or wallet balance' },
  { id: 'confirmation', title: '5. Booking Confirmed!',          desc: 'Get instant SMS confirmation and calendar invite' },
];

export default function BookingFlowSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => setCurrentIndex((p) => (p + 1) % slides.length), 7000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const nextSlide = () => goToSlide((currentIndex + 1) % slides.length);
  const prevSlide = () => goToSlide((currentIndex - 1 + slides.length) % slides.length);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) nextSlide();
    if (diff < -50) prevSlide();
  };

  const current = slides[currentIndex];

  return (
    <section id="how-it-works" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-primary/3 to-background" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">Simple Process</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight mb-4 text-white">How It Works</h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto">From search to test-ready in 4 simple steps</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div
            className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-2xl overflow-hidden border border-gray-200"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Gradient header bar */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 md:p-6">
              <h3 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">{current.title}</h3>
              <p className="text-blue-100 text-sm md:text-lg">{current.desc}</p>
            </div>

            {/* Light panel content area */}
            <div className="p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-[360px] md:min-h-[420px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  {currentIndex === 0 && <SearchStep />}
                  {currentIndex === 1 && <ResultsStep />}
                  {currentIndex === 2 && <ProfileStep />}
                  {currentIndex === 3 && <PaymentStep />}
                  {currentIndex === 4 && <ConfirmationStep />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Nav dots + arrows */}
          <div className="flex flex-col items-center gap-3 mt-6 md:mt-8">
            <div className="flex justify-center gap-2 md:gap-3">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all rounded-full ${
                    index === currentIndex
                      ? 'w-10 md:w-12 h-2.5 md:h-3 bg-blue-400'
                      : 'w-2.5 md:w-3 h-2.5 md:h-3 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button onClick={prevSlide} className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden">
                <ChevronLeft className="w-5 h-5 text-white/60" />
              </button>
              <span className="text-sm text-white/60">Step {currentIndex + 1} of {slides.length}</span>
              <button onClick={nextSlide} className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden">
                <ChevronRight className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SearchStep() {
  return (
    <div className="space-y-6 max-w-sm mx-auto">
      <div className="flex items-center bg-white rounded-xl p-3 shadow-sm border border-gray-200">
        <Search className="w-4 h-4 text-gray-400 mx-3" />
        <span className="text-sm text-gray-500 flex-1">Search</span>
      </div>
      <p className="text-xs text-gray-500 text-center">Example: "Maylands WA", "6051"</p>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[
          { icon: MapPin, label: 'Search by Location', sub: 'Find instructors in your area' },
          { icon: Star, label: 'View Profiles', sub: 'Check ratings and reviews' },
          { icon: Calendar, label: 'Book Instantly', sub: 'Choose time and confirm' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 text-center">
            <item.icon className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xs font-semibold text-gray-800">{item.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsStep() {
  const instructors = [
    { name: 'Sarah J.', trait: 'female, friendly', rate: 45, rating: 4.9 },
    { name: 'Mike T.',  trait: 'male, confident',  rate: 48, rating: 4.8 },
    { name: 'Chloe R.', trait: 'female, patient',  rate: 42, rating: 5.0 },
  ];
  return (
    <div className="max-w-sm mx-auto space-y-3">
      <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">Instructors Near You</h3>
      <p className="text-xs text-gray-500 text-center mb-3">Showing instructors who service: Maylands WA</p>
      {instructors.map((inst) => (
        <div key={inst.name} className="flex items-center justify-between p-4 rounded-xl bg-white shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
              {inst.name[0]}
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">{inst.name}</p>
              <p className="text-xs text-gray-400">{inst.trait}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                <span>({inst.rating})</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm text-gray-900">${inst.rate}/hour</p>
            <p className="text-xs text-gray-400">Manual, Automatic</p>
            <button className="text-xs text-blue-600 font-semibold">Book Now</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileStep() {
  const packages = [
    { hours: 1, price: 45, save: 0 },
    { hours: 5, price: 43, save: 4 },
    { hours: 10, price: 42, save: 7 },
    { hours: 20, price: 40, save: 12 },
  ];
  return (
    <div className="max-w-sm mx-auto grid grid-cols-2 gap-4">
      {/* Left: Instructor Profile */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-2">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-600 mx-auto">S</div>
        <h4 className="font-bold text-sm text-gray-900 text-center">Sarah J.</h4>
        <div className="flex justify-center gap-0.5">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
        </div>
        <p className="text-xs text-gray-500 text-center">(4.9)</p>
        <p className="text-xs text-gray-700 text-center">$45/hour</p>
        <p className="text-xs text-gray-400 text-center">Manual, Automatic</p>
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Service Areas</p>
          <div className="flex flex-wrap gap-1">
            {['6051','6052','6053'].map(c => <span key={c} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{c}</span>)}
          </div>
        </div>
      </div>
      {/* Right: Booking Form */}
      <div className="space-y-2">
        <h4 className="font-bold text-sm text-gray-900">Book Your Lessons</h4>
        <p className="text-xs text-gray-500">Choose a package and save up to 12% on bulk bookings</p>
        {packages.map((pkg) => (
          <div key={pkg.hours} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 text-xs">
            <div>
              <p className="font-semibold text-gray-800">{pkg.hours} Hour{pkg.hours > 1 ? 's' : ''}</p>
              <p className="text-gray-400">${pkg.price}/hour</p>
            </div>
            <div className="text-right">
              {pkg.save > 0 && <p className="text-emerald-600 font-semibold">Save {pkg.save}%</p>}
              <p className="font-bold text-gray-900">${pkg.price * pkg.hours}</p>
            </div>
          </div>
        ))}
        <button className="w-full py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">Continue to Payment</button>
      </div>
    </div>
  );
}

function PaymentStep() {
  return (
    <div className="text-center space-y-4 max-w-xs mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto shadow">
        <CreditCard className="w-7 h-7 text-indigo-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900">Complete Your Payment</h3>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-2 text-sm text-left">
        <p className="text-xs font-semibold text-gray-700 mb-2">Order Summary</p>
        <div className="flex justify-between text-xs"><span className="text-gray-600">10-Hour Package with Sarah J.</span><span className="font-semibold">$420</span></div>
        <div className="flex justify-between text-xs text-emerald-600"><span>Discount (8% off)</span><span>-$36</span></div>
        <div className="border-t border-gray-200 pt-2 flex justify-between text-xs font-bold text-gray-900"><span>Total</span><span>$414</span></div>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold">Credit Card</button>
        <button className="flex-1 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg">Wallet Balance</button>
      </div>
      <p className="text-xs text-gray-500">🔒 Secured by Stripe • Your payment info is encrypted</p>
      <button className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">Pay $414 Now</button>
    </div>
  );
}

function ConfirmationStep() {
  return (
    <div className="text-center space-y-4 max-w-xs mx-auto">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto shadow">
        <CheckCircle className="w-8 h-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900">Booking Confirmed!</h3>
      <p className="text-xs text-gray-500">Your payment was successful and lessons are ready to schedule</p>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-2 text-xs text-left">
        <p className="font-semibold text-gray-700 mb-1">Booking Details</p>
        <div className="flex justify-between"><span className="text-gray-500">Instructor:</span><span className="font-medium">Sarah J.</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Package:</span><span className="font-medium">10 Hours</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Amount Paid:</span><span className="font-medium">$414</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Booking ID:</span><span className="font-medium">#BK-2026-0310</span></div>
      </div>
      <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700 text-left space-y-1 border border-emerald-100">
        <p className="font-semibold mb-1">📱 What Happens Next?</p>
        <p>✓ SMS confirmation sent to your phone</p>
        <p>✓ Email receipt sent to your inbox</p>
        <p>✓ 10 hours added to your account</p>
        <p>→ Schedule your first lesson from your dashboard</p>
      </div>
    </div>
  );
}