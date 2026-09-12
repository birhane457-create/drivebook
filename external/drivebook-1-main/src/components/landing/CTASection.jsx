import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CTASection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Bold gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-violet-700 to-indigo-800" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.15),transparent_60%)]" />

          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-400/10 rounded-full blur-3xl" />

          <div className="relative px-8 py-16 md:px-16 md:py-24 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/90 text-sm font-semibold px-4 py-2 rounded-full mb-8">
              <Zap className="w-4 h-4 text-yellow-300" />
              Start learning today
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-white mb-6">
              Ready to Start Your<br />
              <span className="bg-gradient-to-r from-yellow-300 to-cyan-300 bg-clip-text text-transparent">Driving Journey?</span>
            </h2>
            <p className="text-lg text-white/70 max-w-xl mx-auto mb-10">
              Book your first lesson today and pass your test with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ y: -4, scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 350, damping: 20 }}>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-violet-700 font-bold rounded-xl shadow-2xl hover:shadow-white/20 transition-shadow duration-300 text-base"
              >
                Find Your Instructor <ArrowRight className="w-4 h-4" />
              </Link>
              </motion.div>
            </div>
            <p className="mt-8 text-sm text-white/50">
              Are you a driving instructor?{' '}
              <Link to="/teach-with-drivebook" className="text-white/80 underline underline-offset-4 hover:text-white">
                Learn how DriveBook can grow your business
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}