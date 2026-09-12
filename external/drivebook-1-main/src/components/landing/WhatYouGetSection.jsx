import React from 'react';
import { CreditCard, FileText, BarChart3, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const items = [
  { icon: CreditCard, title: 'Flexible Payment', desc: 'Pay per lesson or save with 5, 10, or 20-hour packages', gradient: 'from-cyan-400 to-blue-500' },
  { icon: FileText, title: 'Test Preparation', desc: 'Book mock tests and test-day packages to boost your confidence', gradient: 'from-pink-500 to-rose-500' },
  { icon: BarChart3, title: 'Progress Tracking', desc: 'View lesson notes and track your improvement over time', gradient: 'from-violet-500 to-purple-600' },
  { icon: CheckCircle, title: 'Instant Confirmation', desc: 'Get booking confirmation via SMS immediately', gradient: 'from-emerald-400 to-teal-500' },
];

export default function WhatYouGetSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-white">
            What You{' '}
            <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">Get</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {items.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -8, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-xl transition-colors duration-300 backdrop-blur-sm cursor-default"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-bold text-sm mb-2 text-white">{item.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}