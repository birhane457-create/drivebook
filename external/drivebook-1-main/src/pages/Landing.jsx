import React from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import TrustBadge from '../components/landing/TrustBadge';
import FeaturesSection from '../components/landing/FeaturesSection';
import AIReceptionistSection from '../components/landing/AIReceptionistSection';
import BookingFlowSection from '../components/landing/BookingFlowSection';
import ProgressSection from '../components/landing/ProgressSection';
import WhatYouGetSection from '../components/landing/WhatYouGetSection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import FAQSection from '../components/landing/FAQSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <HeroSection />
      <TrustBadge />
      <FeaturesSection />
      <AIReceptionistSection />
      <BookingFlowSection />
      <ProgressSection />
      <WhatYouGetSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}