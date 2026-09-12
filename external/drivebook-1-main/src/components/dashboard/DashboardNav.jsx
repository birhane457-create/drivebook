import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, Menu, X, LogOut, Settings, LayoutDashboard, BookOpen, Wallet, Users, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

const clientLinks = [
  { label: 'Dashboard', href: '/client-dashboard', icon: LayoutDashboard },
  { label: 'My Lessons', href: '#', icon: CalendarDays },
  { label: 'Packages', href: '#', icon: BookOpen },
  { label: 'Wallet', href: '#', icon: Wallet },
];

const instructorLinks = [
  { label: 'Dashboard', href: '/instructor-dashboard', icon: LayoutDashboard },
  { label: 'Schedule', href: '#', icon: CalendarDays },
  { label: 'Clients', href: '#', icon: Users },
  { label: 'Earnings', href: '#', icon: Wallet },
  { label: 'Settings', href: '#', icon: Settings },
];

export default function DashboardNav({ role = 'client' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const links = role === 'instructor' ? instructorLinks : clientLinks;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-xl shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline group flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-md shadow-pink-500/30 group-hover:shadow-pink-500/50 transition-shadow duration-300">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-display font-extrabold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            DriveBook
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 mx-6">
          {links.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.label}
                to={link.href}
                className={`relative flex items-center gap-1.5 text-sm no-underline font-medium px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-white/10 group ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}`}
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
                <span className={`absolute bottom-1 left-3 right-3 h-px bg-gradient-to-r from-pink-400 to-violet-400 transition-transform duration-300 origin-left rounded-full ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
              </Link>
            );
          })}
        </nav>

        {/* Right side: user name + avatar + logout */}
        <div className="hidden md:flex items-center gap-3">
          {user?.full_name && (
            <span className="text-sm text-white/50 font-medium">{user.full_name}</span>
          )}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-purple-500/30">
            {initials}
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={menuOpen ? 'close' : 'open'}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.div>
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden bg-slate-950/95 backdrop-blur-xl border-t border-white/10"
          >
            <div className="px-4 py-4 space-y-1">
              {user?.full_name && (
                <div className="flex items-center gap-3 px-3 py-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-white/70">{user.full_name}</span>
                </div>
              )}
              <div className="h-px bg-white/10 mb-2" />
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-white/10 my-2" />
              <button
                onClick={() => logout()}
                className="flex items-center gap-2.5 w-full text-left text-white/60 hover:text-white font-medium py-2.5 px-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}