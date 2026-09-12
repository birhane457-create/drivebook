import React from 'react';
import { motion } from 'framer-motion';

export default function TrustBadge() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-8 md:py-10"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-2xl px-6 py-5 backdrop-blur-sm">
          <span className="text-3xl flex-shrink-0">🛡️</span>
          <div className="text-center sm:text-left">
            <p className="font-bold text-emerald-300 text-lg">Every instructor is background-checked, licensed &amp; approved</p>
            <p className="text-emerald-400/70 text-sm mt-0.5">Credentials verified by DriveBook before they can accept a single booking.</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}