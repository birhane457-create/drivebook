import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, Bell, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

const navGroups = [
  {
    title: 'CORE',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
      { label: 'Bookings', href: '/dashboard/bookings', icon: '📅' },
      { label: 'Clients', href: '/dashboard/clients', icon: '👥' },
      { label: 'Earnings', href: '/dashboard/earnings', icon: '💰' },
    ]
  },
  {
    title: 'BUSINESS',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: '📈' },
      { label: 'Payout Wallet', href: '/dashboard/credits', icon: '💳' },
      { label: 'Documents', href: '/dashboard/documents', icon: '📋' },
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Availability', href: '/dashboard/availability', icon: '🕐' },
      { label: 'Packages', href: '/dashboard/packages', icon: '📦' },
      { label: 'PDA Tests', href: '/dashboard/pda-tests', icon: '✅' },
    ]
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'Branding', href: '/dashboard/branding', icon: '🎨' },
      { label: 'Profile', href: '/dashboard/profile', icon: '👤' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
      { label: 'Help', href: '/dashboard/help', icon: '❓' },
    ]
  }
];

export default function InstructorNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const location = useLocation();
  const { logout } = useAuth();
  const notificationCount = 3; // Mock data

  const isActive = (href) => {
    if (href === '/dashboard') return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  const toggleDropdown = (title) => {
    setOpenDropdown(openDropdown === title ? null : title);
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
          <span className="hidden md:inline-block px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-xs font-semibold text-green-300">
            Instructor
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 mx-8">
          {navGroups.map((group) => (
            <div key={group.title} className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white transition-colors hover:bg-white/5">
                {group.title}
                <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
              </button>
              
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 mt-1 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
                >
                  <div className="py-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        to={item.href}
                        className={`flex items-center gap-2 px-4 py-2 text-sm transition-all ${
                          isActive(item.href)
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
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
              <div className="px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-xs font-semibold text-green-300 inline-block">
                Instructor
              </div>

              {/* Nav Groups Mobile */}
              {navGroups.map((group) => (
                <div key={group.title}>
                  <button
                    onClick={() => toggleDropdown(group.title)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {group.title}
                    <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === group.title ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {openDropdown === group.title && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-4 space-y-1 overflow-hidden"
                      >
                        {group.items.map((item) => (
                          <Link
                            key={item.label}
                            to={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                              isActive(item.href)
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <span>{item.icon}</span>
                            {item.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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