import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'For Instructors', href: '/teach-with-drivebook', isRoute: true },
  { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-500 ${
      scrolled
        ? 'bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-xl shadow-black/20'
        : 'bg-gradient-to-r from-violet-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-md border-b border-white/5'
    }`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-md shadow-pink-500/30 group-hover:shadow-pink-500/50 transition-shadow duration-300">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-display font-extrabold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            DriveBook
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                className="relative text-sm text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-white/10 group"
              >
                {link.label}
                <span className="absolute bottom-1 left-3 right-3 h-px bg-gradient-to-r from-pink-400 to-violet-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="relative text-sm text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-white/10 group"
              >
                {link.label}
                <span className="absolute bottom-1 left-3 right-3 h-px bg-gradient-to-r from-pink-400 to-violet-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </a>
            )
          )}

          <div className="w-px h-5 bg-white/10 mx-2" />

          <Link
            to="/login"
            className="text-sm text-white/70 hover:text-white no-underline font-medium px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-white/10"
          >
            Log in
          </Link>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/register"
              className="ml-1 bg-gradient-to-r from-pink-500 to-violet-500 text-white px-5 py-2 rounded-xl no-underline text-sm font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:from-pink-400 hover:to-violet-400 transition-all duration-300"
            >
              Get Started
            </Link>
          </motion.div>
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

      {/* Mobile Menu */}
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
              {navLinks.map((link) =>
                link.isRoute ? (
                  <Link
                    key={link.label}
                    to={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                )
              )}
              <div className="h-px bg-white/10 my-2" />
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block text-white/70 hover:text-white no-underline font-medium py-2.5 px-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={() => setMenuOpen(false)}
                className="block bg-gradient-to-r from-pink-500 to-violet-500 text-white px-5 py-3 rounded-xl no-underline font-bold text-center text-sm shadow-lg shadow-purple-500/30 mt-1"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}