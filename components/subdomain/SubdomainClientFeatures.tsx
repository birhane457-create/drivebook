'use client';

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';

export default function SubdomainClientFeatures({ primary }: { primary: string }) {
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky button after scrolling past the hero (roughly 300px)
      setShowSticky(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBooking = () => {
    document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* Sticky mobile Book Now button */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden transition-transform duration-300 ${
          showSticky ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ background: 'linear-gradient(to top, white 60%, transparent)' }}
      >
        <button
          onClick={scrollToBooking}
          className="w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: primary }}
        >
          <CalendarDays className="h-5 w-5" />
          Book a Lesson
        </button>
      </div>
    </>
  );
}
