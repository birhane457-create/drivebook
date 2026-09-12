import React from 'react';
import { Wallet, BookOpen, CalendarDays, Clock, Plus, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import StudentNav from '@/components/StudentNav';
import Footer from '@/components/landing/Footer';

// Mock data — no backend logic touched
const mockData = {
  walletBalance: 126.00,
  completedLessons: 8,
  upcomingLessons: [
    { id: 1, instructor: 'Sarah J.', date: 'Thu, Mar 14 · 2:00 PM', duration: '1 hour' },
    { id: 2, instructor: 'Sarah J.', date: 'Mon, Mar 18 · 10:00 AM', duration: '2 hours' },
  ],
};

const statCards = [
  { label: 'Wallet Balance', value: `$${mockData.walletBalance.toFixed(2)}`, icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' },
  { label: 'Completed Lessons', value: mockData.completedLessons, icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: 'shadow-blue-500/10' },
  { label: 'Upcoming Lessons', value: mockData.upcomingLessons.length, icon: CalendarDays, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' },
];

export default function ClientDashboard() {
  return (
    <div className="min-h-screen bg-slate-950">
      <StudentNav />

      {/* Page header banner */}
      <div className="relative border-b border-white/5 bg-gradient-to-r from-blue-950/60 via-slate-950 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">Student Portal</p>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white">
              Welcome back! 👋
            </h1>
            <p className="text-white/40 mt-1 text-sm">Manage your lessons and account.</p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Stat cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative p-6 rounded-2xl bg-white/[0.03] border ${stat.border} hover:bg-white/[0.06] hover:shadow-xl ${stat.glow} transition-all duration-300 overflow-hidden`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">{stat.label}</p>
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-3xl font-display font-extrabold text-white tracking-tight">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Upcoming lessons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <h2 className="font-display font-bold text-white text-sm">Upcoming Lessons</h2>
              </div>
              <a href="#" className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                View All <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {mockData.upcomingLessons.map((lesson, i) => (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                      {lesson.instructor[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{lesson.instructor}</p>
                      <p className="text-xs text-white/40 mt-0.5">{lesson.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/50">
                    <Clock className="w-3 h-3" />
                    {lesson.duration}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl bg-white/[0.03] border border-white/10 p-5"
          >
            <h2 className="font-display font-bold mb-4 text-white text-sm">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Book Lesson', icon: Plus, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'View Wallet', icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'My Packages', icon: BookOpen, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { label: 'Add Funds', icon: ArrowRight, color: 'text-white/50', bg: 'bg-white/5' },
              ].map((action) => (
                <a
                  key={action.label}
                  href="#"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors group border border-transparent hover:border-white/10"
                >
                  <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center`}>
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{action.label}</span>
                  <ArrowRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/40 transition-colors" />
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}