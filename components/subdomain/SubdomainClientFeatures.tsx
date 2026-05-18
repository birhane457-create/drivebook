'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { CalendarDays, Phone, Info, Briefcase, ChevronLeft } from 'lucide-react';

// Context so the booking page can trigger the drawer open
export const BookingDrawerContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function useBookingDrawer() {
  return useContext(BookingDrawerContext);
}

interface Props {
  primary: string;
  instructorName?: string;
  isAcceptingBookings?: boolean; // hides "Book Now" button when instructor is inactive
  children?: React.ReactNode; // booking form passed as children for the drawer
}

export default function SubdomainClientFeatures({ primary, instructorName, isAcceptingBookings = true, children }: Props) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = bookingOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [bookingOpen]);

  const scrollTo = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const offset = 16;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 50);
  };

  const openBooking = () => {
    if (window.innerWidth < 768) {
      setBookingOpen(true);
    } else {
      scrollTo('booking-form');
    }
  };

  return (
    <BookingDrawerContext.Provider value={{ open: bookingOpen, setOpen: setBookingOpen }}>
      {/* ── Mobile bottom nav ──────────────────────────────────────────── */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 transition-shadow duration-200 ${
          scrolled ? 'shadow-[0_-4px_16px_rgba(0,0,0,0.10)]' : ''
        }`}
      >
        <div className="flex items-stretch">
          <NavTab icon={<Info className="h-5 w-5" />} label="About" onClick={() => scrollTo('section-about')} />
          <NavTab icon={<Briefcase className="h-5 w-5" />} label="Services" onClick={() => scrollTo('section-services')} />
          <NavTab icon={<Phone className="h-5 w-5" />} label="Contact" onClick={() => scrollTo('section-contact')} />
          {isAcceptingBookings ? (
            <button
              onClick={openBooking}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-white font-bold"
              style={{ backgroundColor: primary }}
            >
              <CalendarDays className="h-5 w-5" />
              <span className="text-[11px] font-bold">Book Now</span>
            </button>
          ) : (
            <a
              href="/book"
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 bg-gray-200 text-gray-500"
            >
              <CalendarDays className="h-5 w-5" />
              <span className="text-[11px] font-medium">Find Others</span>
            </a>
          )}
        </div>
        {/* iPhone safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom)', backgroundColor: 'white' }} />
      </nav>

      {/* ── Full-screen booking drawer (mobile) ────────────────────────── */}
      <div
        className={`fixed inset-0 z-[60] flex flex-col bg-white md:hidden transition-transform duration-300 ease-in-out ${
          bookingOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b border-gray-100" style={{ backgroundColor: primary }}>
          <button
            onClick={() => setBookingOpen(false)}
            className="text-white p-1.5 rounded-lg hover:bg-white/20 active:bg-white/30"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <p className="text-white font-bold text-base leading-tight">Book a Lesson</p>
            {instructorName && <p className="text-white/80 text-xs">with {instructorName}</p>}
          </div>
        </div>

        {/* Scrollable content — booking form passed as children */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 pb-8">
            {children ?? (
              <p className="text-gray-500 text-sm text-center mt-8">Loading booking form...</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav spacer so page content isn't hidden */}
      <div className="h-16 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </BookingDrawerContext.Provider>
  );
}

function NavTab({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-gray-500 active:text-gray-900 active:bg-gray-50"
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
