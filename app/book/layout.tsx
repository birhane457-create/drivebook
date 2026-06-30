import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find a Driving Instructor Near You – Book Online',
  description:
    'Search driving instructors by suburb or postcode. Compare ratings, prices, and availability. Book your first lesson instantly — Manual & Automatic available across Australia.',
  openGraph: {
    title: 'Find a Driving Instructor Near You',
    description:
      'Search by suburb, compare instructors, and book your lesson instantly. Approved instructors, transparent pricing.',
  },
  alternates: {
    canonical: 'https://drivebook.com.au/book',
  },
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
