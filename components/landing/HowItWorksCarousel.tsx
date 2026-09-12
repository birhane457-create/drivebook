'use client'

import ImageCarousel from './ImageCarousel'

export default function HowItWorksCarousel() {
  const slides = [
    {
      id: 'search',
      image: '/images/landing/how-it-works-search.jpg', // Replace with actual image path
      title: '1. Search Your Area',
      description: 'Enter your postcode and find verified instructors near you',
      category: 'How It Works'
    },
    {
      id: 'choose',
      image: '/images/landing/how-it-works-choose.jpg',
      title: '2. Choose Your Instructor',
      description: 'View verified credentials, reviews, and real-time availability',
      category: 'How It Works'
    },
    {
      id: 'book',
      image: '/images/landing/how-it-works-book.jpg',
      title: '3. Book Instantly',
      description: 'Get SMS confirmation and calendar invite in seconds',
      category: 'How It Works'
    }
  ]

  return <ImageCarousel slides={slides} autoPlayInterval={7000} />
}

