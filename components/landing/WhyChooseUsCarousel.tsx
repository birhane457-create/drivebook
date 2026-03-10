'use client'

import ImageCarousel from './ImageCarousel'

export default function WhyChooseUsCarousel() {
  const slides = [
    {
      id: 'safety',
      image: '/images/landing/why-safety.jpg', // Replace with actual image path
      title: 'Your Safety is Guaranteed',
      description: 'Every instructor undergoes 5-step verification including background checks, license validation, and insurance verification',
      category: 'Why Choose Us'
    },
    {
      id: 'booking',
      image: '/images/landing/why-booking.jpg',
      title: 'No More Phone Tag',
      description: 'See real-time availability and book in seconds - no waiting, no voicemail, no hassle',
      category: 'Why Choose Us'
    },
    {
      id: 'progress',
      image: '/images/landing/why-progress.jpg',
      title: 'Track Your Progress',
      description: 'See exactly what you need to work on before your test with detailed performance tracking',
      category: 'Why Choose Us'
    },
    {
      id: 'ai-receptionist',
      image: '/images/landing/why-ai-receptionist.jpg',
      title: 'Call Anytime - AI Answers 24/7',
      description: 'Prefer to call? Our AI receptionist handles bookings, rescheduling, and questions around the clock',
      category: 'Why Choose Us'
    }
  ]

  return <ImageCarousel slides={slides} autoPlayInterval={7000} />
}
