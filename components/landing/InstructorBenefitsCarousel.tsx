'use client'

import ImageCarousel from './ImageCarousel'

export default function InstructorBenefitsCarousel() {
  const slides = [
    {
      id: 'never-miss',
      image: '/images/landing/instructor-never-miss.jpg', // Replace with actual image path
      title: 'Never Miss a Booking',
      description: 'AI receptionist handles calls while you teach - recover £1,500-£2,500 per week in missed bookings',
      category: 'For Instructors'
    },
    {
      id: 'automated',
      image: '/images/landing/instructor-automated.jpg',
      title: 'Focus on Teaching, Not Admin',
      description: 'Automated scheduling, payments, and reminders - stop chasing payments and managing spreadsheets',
      category: 'For Instructors'
    },
    {
      id: 'payouts',
      image: '/images/landing/instructor-payouts.jpg',
      title: 'Get Paid Every Week',
      description: 'Direct deposit with transparent fees - no monthly charges, only pay per completed lesson',
      category: 'For Instructors'
    },
    {
      id: 'feedback',
      image: '/images/landing/instructor-feedback.jpg',
      title: 'Easy Feedback Entry',
      description: 'Tap-friendly interface - no codes to remember, just tap issues observed and system does the rest',
      category: 'For Instructors'
    }
  ]

  return <ImageCarousel slides={slides} autoPlayInterval={7000} />
}
