import React from 'react';
import { DollarSign, Users, FileText, AlertTriangle, TrendingUp, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminNav from '@/components/AdminNav';
import Footer from '@/components/landing/Footer';

// Mock data — no backend logic touched
const mock = {
  platformRevenue: 24580,
  totalInstructors: 342,
  totalClients: 1847,
  pendingDocuments: 12,
  pendingDisputes: 3,
  monthlyBookings: 2156,
  avgRating: 4.8,
  percentChange: 8.5,
  recentInstructors: [
    { id: 1, name: 'Sarah Johnson', status: 'Approved', date: 'Mar 14', bookings: 24 },
    { id: 2, name: 'Michael Chen', status: 'Pending Review', date: 'Mar 13', bookings: 0 },
    { id: 3, name: 'Emma Davis', status: 'Approved', date: 'Mar 12', bookings: 18 },
  ],
  alerts: [
    { id: 1, type: 'document', message: '12 documents pending verification', count: 12, icon: '📄' },
    { id: 2, type: 'dispute', message: '3 payment disputes open', count: 3, icon: '⚖️' },
    { id: 3, type: 'suspension', message: '1 instructor flagged for review', count: 1, icon: '🚩' },
  ],
};

const statCards = [
  { label: 'Platform Revenue (MTD)', value: `$${mock.platformRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10', sub: `+${mock.percentChange}% vs last month` },
  { label: 'Total Instructors', value: mock.totalInstructors, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', glow: 'shadow-blue-500/10' },
  { label: 'Total Clients', value: mock.totalClients.toLocaleString(), icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' },
  { label: 'Monthly Bookings', value: mock.monthlyBookings.toLocaleString(), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-slate-950">
      <AdminNav />

      {/* Page header banner */}
      <div className="relative border-b border-white/5 bg-gradient-to-r from-red-950/60 via-slate-950 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-1">Admin Control Panel</p>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-white">
              Platform Overview 🎛️
            </h1>
            <p className="text-white/40 mt-1 text-sm">Manage instructors, clients, finances, and operations.</p>
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
                <p className="text-xs text-emerald-400/70 mt-2">{stat.sub}</p>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Alerts & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="font-display font-bold text-white text-sm">System Alerts & Pending Actions</h2>
              </div>
              <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-1 rounded-full font-semibold">
                {mock.alerts.reduce((sum, a) => sum + a.count, 0)} items
              </span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {mock.alerts.map((alert, i) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.07 }}
                  className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{alert.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{alert.message}</p>
                      <p className="text-xs text-white/40 mt-0.5">Click to review and take action</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-bold text-red-400">
                      {alert.count}
                    </span>
                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4"
          >
            <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <span>📊</span> Quick Stats
            </h2>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] transition-colors">
                <p className="text-xs text-white/50 mb-1">Platform Rating</p>
                <p className="text-2xl font-bold text-white">{mock.avgRating} ⭐</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] transition-colors">
                <p className="text-xs text-white/50 mb-1">Pending Documents</p>
                <p className="text-2xl font-bold text-amber-400">{mock.pendingDocuments}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] transition-colors">
                <p className="text-xs text-white/50 mb-1">Open Disputes</p>
                <p className="text-2xl font-bold text-red-400">{mock.pendingDisputes}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Instructors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="font-display font-bold text-white text-sm">Recent Instructor Registrations</h2>
            </div>
            <a href="#" className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {mock.recentInstructors.map((instructor, i) => (
              <motion.div
                key={instructor.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                    {instructor.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{instructor.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">Registered {instructor.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {instructor.status === 'Approved' ? (
                    <span className="flex items-center gap-1 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-xs font-semibold text-green-400">
                      <CheckCircle className="w-3 h-3" /> {instructor.status}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-semibold text-amber-400">
                      {instructor.status}
                    </span>
                  )}
                  <span className="text-xs font-medium text-white/50">{instructor.bookings} bookings</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="rounded-2xl bg-white/[0.03] border border-white/10 p-5"
        >
          <h2 className="font-display font-bold text-sm mb-4 text-white">Admin Actions</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Manage Instructors', icon: '👨‍🏫', href: '#' },
              { label: 'Manage Clients', icon: '👨‍🎓', href: '#' },
              { label: 'Review Documents', icon: '📄', href: '#' },
              { label: 'Process Payouts', icon: '💰', href: '#' },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl hover:bg-white/10 transition-colors group border border-transparent hover:border-white/10"
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-xs font-medium text-white/70 group-hover:text-white text-center transition-colors">{action.label}</span>
              </a>
            ))}
          </div>
        </motion.div>

      </main>

      <Footer />
    </div>
  );
}