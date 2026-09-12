import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, Bell, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { label: 'Dashboard', href: '/client-dashboard', icon: '📊' },
  { label: 'Book Lesson', href: '/client-dashboard/book-lesson', icon: '🎓' },
  { label: 'My Bookings', href: '/client-dashboard/bookings', icon: '📅' },
  { label: 'Wallet', href: '/client-dashboard/wallet', icon: '💳' },
  { label: 'Reviews', href: '/client-dashboard/reviews', icon: '⭐' },
  { label: 'Profile', href: '/client-dashboard/profile', icon: '👤' },
  { label: 'Help', href: '/client-dashboard/help', icon: '❓' },
];

export default function StudentNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();
  const notificationCount = 1; // Mock data

  const isActive = (href) => {
    if (href === '/client-dashboard') return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/60 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">

        {/* Logo + Role Badge */}
        <Link to="/" className="flex items-center gap-3 no-underline flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40 hover:shadow-blue-600/60 transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            DriveBook
          </span>
          <span className="hidden md:inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-xs font-semibold text-blue-300">
            Student
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 mx-8">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive(item.href)
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Side: Bell + Logout */}
        <div className="hidden lg:flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Bell className="w-5 h-5 text-white/70 hover:text-white" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-xs font-bold text-white flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>
          <button
            onClick={() => logout()}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-slate-900/95 backdrop-blur-xl border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {/* Role Badge Mobile */}
              <div className="px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-xs font-semibold text-blue-300 inline-block mb-4">
                Student
              </div>

              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div className="h-px bg-white/10 my-2" />

              <button
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}