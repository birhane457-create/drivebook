import React from 'react';
import { CalendarDays, Users, DollarSign, Clock, TrendingUp, Plus, Settings, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import InstructorNav from '@/components/InstructorNav';
import Footer from '@/components/landing/Footer';

// Mock data — no backend logic touched
const mock = {
  name: 'Sarah Johnson',
  hourlyRate: 45,
  upcomingCount: 3,
  totalClients: 24,
  monthRevenue: 1890,
  dailyAvg: 94.5,
  percentChange: 12.3,
  upcomingLessons: [
    { id: 1, client: 'John S.', date: 'Thu, Mar 14 · 2:00 PM', duration: '1 hour', pickup: 'Maylands WA' },
    { id: 2, client: 'Emily R.', date: 'Fri, Mar 15 · 9:00 AM', duration: '2 hours', pickup: 'Mt Lawley' },
    { id: 3, client: 'David K.', date: 'Fri, Mar 15 · 1:00 PM', duration: '1 hour', pickup: 'Bayswater' },
  ],
  attentionClients: [
    { id: 1, name: 'Alex M.', hoursRemaining: 5, daysInactive: 21, value: 225 },
    { id: 2, name: 'Priya S.', hoursRemaining: 3, daysInactive: 16, value: 135 },
  ],
};

const statCards = [
  { label: 'Upcoming Lessons', value: mock.upcomingCount, icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: 'shadow-blue-500/10' },
  { label: 'Total Clients', value: mock.totalClients, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' },
  { label: 'This Month (MTD)', value: `$${mock.monthRevenue}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10', sub: `$${mock.dailyAvg}/day avg` },
  { label: 'Hourly Rate', value: `$${mock.hourlyRate}`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' },
];

export default function InstructorDashboard() {
  return (
    <div className="min-h-screen bg-slate-950">
      <InstructorNav />

      {/* Page header banner */}
      <div className="relative border-b border-white/5 bg-gradient-to-r from-violet-950/60 via-slate-950 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-1">Instructor Portal</p>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white">
              Welcome back, {mock.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-white/40 mt-1 text-sm">Here's what's happening with your driving school today.</p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Stat cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`relative p-6 rounded-2xl bg-white/[0.03] border ${stat.border} hover:bg-white/[0.06] hover:shadow-xl ${stat.glow} transition-all duration-300 overflow-hidden group`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
              <div className="flex items-start justify-between mb-4">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">{stat.label}</p>
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-3xl font-display font-extrabold text-white tracking-tight">{stat.value}</p>
              {stat.sub && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-white/35">{stat.sub}</span>
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> +{mock.percentChange}%
                  </span>
                </div>
              )}
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
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-400" />
                <h2 className="font-display font-bold text-white text-sm">Upcoming Lessons</h2>
              </div>
              <a href="#" className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                View All <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {mock.upcomingLessons.map((lesson, i) => (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                      {lesson.client[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{lesson.client}</p>
                      <p className="text-xs text-white/40 mt-0.5">{lesson.date}</p>
                      {lesson.pickup && (
                        <p className="text-xs text-white/25 mt-0.5 flex items-center gap-1">
                          <span>📍</span> {lesson.pickup}
                        </p>
                      )}
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

          {/* Sidebar */}
          <div className="space-y-5">

            {/* Clients needing attention */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-white/[0.03] border border-amber-500/20 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/10 bg-amber-500/5 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <h2 className="font-display font-bold text-sm text-white">Needs Attention</h2>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {mock.attentionClients.map((client) => (
                  <div key={client.id} className="px-5 py-4 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-white">{client.name}</p>
                      {client.daysInactive > 14 && (
                        <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40">
                      {client.hoursRemaining} hrs unused · <span className="text-emerald-400/70">${client.value} value</span>
                    </p>
                    <p className="text-xs text-white/25 mt-0.5">Last booked {client.daysInactive} days ago</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-5"
            >
              <h2 className="font-display font-bold text-sm mb-4 text-white">Quick Actions</h2>
              <div className="space-y-2">
                {[
                  { label: 'New Booking', icon: Plus, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Add Client', icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                  { label: 'Settings', icon: Settings, color: 'text-white/50', bg: 'bg-white/5' },
                ].map((action) => (
                  <a
                    key={action.label}
                    href="#"
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors group border border-transparent hover:border-white/10"
                  >
                    <div className={`w-8 h-8 rounded-lg ${action.bg} flex items-center justify-center transition-colors`}>
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                    </div>
                    <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{action.label}</span>
                    <ArrowRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/40 transition-colors" />
                  </a>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}