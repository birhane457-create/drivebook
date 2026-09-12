import React from 'react';
import { Link } from 'react-router-dom';
import { Search, GraduationCap, Building2, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Hero gradient background */}
      <div className="relative bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white py-20 md:py-32 px-4 text-center overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl translate-y-1/2" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-violet-500/20 rounded-full blur-2xl -translate-x-1/2" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-semibold px-4 py-2 rounded-full mb-8"
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
            Australia's #1 Driving Lesson Marketplace
          </motion.div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-[1.05] mb-6">
            Pass Your Driving Test<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent"> with Confidence</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100 max-w-2xl mx-auto leading-relaxed">
            Book local instructors in seconds. Flexible lessons, transparent pricing, approved instructors.
          </p>

          {/* Bullet list */}
          <ul className="text-left inline-block max-w-xl text-base md:text-lg space-y-2 mb-12 text-purple-100">
            <li>🎯 Smart booking with real-time availability — no waiting, no phone tag</li>
            <li>📍 Location-based matching to find instructors who service your area</li>
            <li>💰 Save up to 12% with bulk hour packages and test preparation bundles</li>
            <li>📞 Book by phone — AI answers 24/7, no app download needed</li>
          </ul>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="max-w-xl mx-auto"
          >
            <div className="flex items-center bg-white rounded-2xl shadow-2xl shadow-purple-900/50 p-2 ring-2 ring-white/20">
              <Search className="w-5 h-5 text-gray-400 ml-4 mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Enter your suburb or postcode..."
                className="flex-1 py-3 text-base bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                readOnly
              />
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="px-6 py-3 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold rounded-xl shadow-lg hover:from-pink-400 hover:to-violet-500 transition-all duration-300 text-sm">
                Search
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Audience fork cards */}
      <div className="relative bg-gradient-to-b from-indigo-950 to-slate-900 py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
        >
          {/* Learner card */}
          <motion.div whileHover={{ y: -6, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-cyan-400/40 hover:shadow-2xl hover:shadow-cyan-500/20 transition-all duration-500 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 group-hover:from-cyan-500/20 transition-all duration-500" />
            <div className="relative p-8 md:p-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mb-5 shadow-lg shadow-cyan-500/30">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-display font-bold mb-3 text-white">I want to learn to drive</h3>
              <p className="text-purple-300 mb-6 leading-relaxed">
                Find a verified local instructor, book instantly, track your progress.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 text-sm font-bold text-cyan-400 group-hover:gap-3 transition-all"
              >
                Find an instructor <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Instructor card */}
          <motion.div whileHover={{ y: -6, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-pink-400/40 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-500 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-violet-600/5 group-hover:from-pink-500/20 transition-all duration-500" />
            <div className="relative p-8 md:p-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-pink-500/30">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-display font-bold mb-3 text-white">I want to grow my driving school</h3>
              <p className="text-purple-300 mb-6 leading-relaxed">
                Automate bookings, payments, and admin. AI receptionist included.
              </p>
              <Link
                to="/teach-with-drivebook"
                className="inline-flex items-center gap-2 text-sm font-bold text-pink-400 group-hover:gap-3 transition-all"
              >
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}