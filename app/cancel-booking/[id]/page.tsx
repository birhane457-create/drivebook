import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import CancelBookingForm from '@/components/CancelBookingForm'
import { Car } from 'lucide-react'
import Link from 'next/link'

export default async function CancelBookingPage({ params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      instructor: true
    }
  })

  if (!booking) {
    notFound()
  }

  // Calculate hours until booking
  const now = new Date()
  const bookingTime = new Date(booking.startTime)
  const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  // Calculate refund
  let refundPercentage = 0
  if (hoursUntilBooking >= 48) {
    refundPercentage = 100
  } else if (hoursUntilBooking >= 24) {
    refundPercentage = 50
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900">DriveBook</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Cancel Booking</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Booking Details</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Instructor:</span> {booking.instructor.name}</p>
            <p><span className="font-medium">Student:</span> {booking.client.name}</p>
            <p><span className="font-medium">Date:</span> {new Date(booking.startTime).toLocaleDateString()}</p>
            <p><span className="font-medium">Time:</span> {new Date(booking.startTime).toLocaleTimeString()}</p>
            <p><span className="font-medium">Price:</span> ${booking.price}</p>
          </div>
        </div>

        <CancelBookingForm 
          bookingId={booking.id}
          hoursUntilBooking={hoursUntilBooking}
          refundPercentage={refundPercentage}
          price={booking.price}
        />
      </div>
    </div>
  )
}
