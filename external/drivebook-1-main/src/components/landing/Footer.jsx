import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-slate-950 to-black border-t border-white/5 text-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="text-2xl font-bold no-underline">
              <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">DriveBook</span>
            </Link>
            <p className="text-white/40 text-sm mt-3 leading-relaxed">
              Australia's trusted driving lesson marketplace. Find verified instructors, book instantly, and track your progress.
            </p>
          </div>

          {/* For Learners */}
          <div>
            <h4 className="font-bold text-sm mb-4 text-white/80 uppercase tracking-wider">For Learners</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li><Link to="/register" className="hover:text-white transition-colors no-underline">Find Instructors</Link></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors no-underline">How It Works</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors no-underline">FAQ</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors no-underline">Learner Terms</a></li>
            </ul>
          </div>

          {/* For Instructors */}
          <div>
            <h4 className="font-bold text-sm mb-4 text-white/80 uppercase tracking-wider">For Instructors</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li><Link to="/teach-with-drivebook" className="hover:text-white transition-colors no-underline">Join DriveBook</Link></li>
              <li><Link to="/teach-with-drivebook" className="hover:text-white transition-colors no-underline">Benefits</Link></li>
              <li><Link to="/teach-with-drivebook" className="hover:text-white transition-colors no-underline">Pricing</Link></li>
              <li><a href="/instructor-terms" className="hover:text-white transition-colors no-underline">Instructor Terms</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-sm mb-4 text-white/80 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li><a href="/about" className="hover:text-white transition-colors no-underline">About Us</a></li>
              <li><a href="/contact" className="hover:text-white transition-colors no-underline">Contact Us</a></li>
              <li><a href="/blog" className="hover:text-white transition-colors no-underline">Blog</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors no-underline">Privacy Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/25">© {new Date().getFullYear()} DriveBook. All rights reserved.</p>
          <p className="text-xs text-white/25">Made with ❤️ in Australia</p>
        </div>
      </div>
    </footer>
  );
}