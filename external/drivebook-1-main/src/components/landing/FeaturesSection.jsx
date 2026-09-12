import React from 'react';
import { ShieldCheck, Zap, DollarSign, Smartphone, BarChart3, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: ShieldCheck,
    title: 'Trusted & Approved',
    description: 'Background-checked, licensed, and reviewed by real students before they can take a booking. Your safety comes first.',
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'hover:shadow-emerald-500/20',
    border: 'hover:border-emerald-500/40',
  },
  {
    icon: Zap,
    title: 'Book in Seconds',
    description: 'See real-time availability and reserve your lesson instantly—no phone calls, no waiting, no hassle.',
    gradient: 'from-yellow-400 to-orange-500',
    glow: 'hover:shadow-yellow-500/20',
    border: 'hover:border-yellow-500/40',
  },
  {
    icon: DollarSign,
    title: 'Flexible Packages',
    description: 'Pay-as-you-go or save up to 12% with bulk packages. Cancel or reschedule easily through your dashboard.',
    gradient: 'from-cyan-400 to-blue-500',
    glow: 'hover:shadow-cyan-500/20',
    border: 'hover:border-cyan-500/40',
  },
  {
    icon: Smartphone,
    title: 'Smart Reminders',
    description: 'Get SMS notifications before your lesson so you never miss a session. Stay on track with your learning.',
    gradient: 'from-pink-500 to-rose-500',
    glow: 'hover:shadow-pink-500/20',
    border: 'hover:border-pink-500/40',
  },
  {
    icon: BarChart3,
    title: 'Track Your Progress',
    description: 'View lesson notes and track your improvement over time. See exactly what you need to work on.',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'hover:shadow-violet-500/20',
    border: 'hover:border-violet-500/40',
  },
  {
    icon: Target,
    title: 'Test Preparation',
    description: 'Book mock tests and test-day packages to boost your confidence and pass on your first try.',
    gradient: 'from-indigo-400 to-blue-600',
    glow: 'hover:shadow-indigo-500/20',
    border: 'hover:border-indigo-500/40',
  },
];

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">Why DriveBook</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-white">
            Why Choose{' '}
            <span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">DriveBook?</span>
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              whileHover={{ y: -8, scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`group relative p-8 rounded-2xl bg-white/5 border border-white/10 ${feature.border} hover:shadow-xl ${feature.glow} transition-colors duration-300 backdrop-blur-sm cursor-default`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-display font-bold mb-2 text-white">{feature.title}</h3>
              <p className="text-white/60 leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}