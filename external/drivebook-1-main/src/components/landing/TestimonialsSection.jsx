import React from 'react';
import { Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "I passed my test on the first try! DriveBook matched me with an instructor who understood exactly what I needed. The booking system made everything so easy.",
    name: "Sarah M.",
    role: "New Driver, Perth",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    quote: "As a parent I was nervous about putting my daughter in a car with a stranger. DriveBook made it easy — I could see the instructor's credentials, read real reviews, and track her progress.",
    name: "Linda R.",
    role: "Parent, Perth",
    gradient: "from-pink-500 to-violet-600",
  },
  {
    quote: "The bulk package saved me money and the SMS reminders kept me on track. Highly recommend!",
    name: "Michael K.",
    role: "New Driver",
    gradient: "from-amber-400 to-orange-500",
  },
];

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-pink-400 uppercase tracking-wider mb-3">Testimonials</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-white">
            What Our Community Says
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="group relative p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/8 hover:shadow-2xl hover:shadow-violet-500/15 transition-colors duration-300 backdrop-blur-sm cursor-default"
            >
              <Quote className="w-8 h-8 text-white/10 mb-4" />
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/50">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}