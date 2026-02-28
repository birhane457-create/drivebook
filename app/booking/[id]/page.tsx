import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CheckInOutButton from '@/components/CheckInOutButton';
import Link from 'next/link';
import { formatBookingId } from '@/lib/utils';

export default async function BookingDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      instructor: { select: { name: true, phone: true, profileImage: true } },
      client: { select: { name: true, phone: true, email: true } },
    },
  }) as any;

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Found</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isInstructor = session.user.role === 'INSTRUCTOR';
  const now = new Date();
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  const isActive = now >= startTime && now <= endTime;
  const isPast = now > endTime;

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking Details</h1>
              <span className={`px-3 py-1 text-xs sm:text-sm font-semibold rounded-full ${
                booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                booking.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {booking.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">ID: #{formatBookingId(booking.id)}</p>
          </div>

          {/* Booking Info */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Instructor</p>
                <p className="font-medium text-gray-900">{booking.instructor.name}</p>
                <p className="text-sm text-gray-500">{booking.instructor.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Client</p>
                <p className="font-medium text-gray-900">{booking.client.name}</p>
                <p className="text-sm text-gray-500">{booking.client.phone}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Scheduled Start</p>
                  <p className="font-medium text-gray-900">
                    {startTime.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {startTime.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Scheduled End</p>
                  <p className="font-medium text-gray-900">
                    {endTime.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {endTime.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {booking.pickupAddress && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-1">Pickup Location</p>
                <p className="text-gray-900">{booking.pickupAddress}</p>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Price</span>
                <span className="text-2xl font-bold text-gray-900">${booking.price.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Check-in/Check-out Status */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lesson Tracking</h2>
            
            <div className="space-y-4">
              {/* Check-in Status */}
              <div className={`border rounded-lg p-4 ${booking.checkInTime ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Check-In</span>
                  {booking.checkInTime && (
                    <span className="text-green-600 font-semibold">✓ Completed</span>
                  )}
                </div>
                {booking.checkInTime ? (
                  <div className="text-sm space-y-1">
                    <p className="text-gray-700">
                      Time: {new Date(booking.checkInTime).toLocaleString()}
                    </p>
                    <p className="text-gray-700">
                      By: {booking.checkInBy === 'instructor' ? booking.instructor.name : booking.client.name}
                    </p>
                    {booking.checkInLocation && (
                      <p className="text-gray-600 text-xs">
                        Location: {booking.checkInLocation}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Not checked in yet</p>
                )}
              </div>

              {/* Check-out Status */}
              <div className={`border rounded-lg p-4 ${booking.checkOutTime ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Check-Out</span>
                  {booking.checkOutTime && (
                    <span className="text-blue-600 font-semibold">✓ Completed</span>
                  )}
                </div>
                {booking.checkOutTime ? (
                  <div className="text-sm space-y-1">
                    <p className="text-gray-700">
                      Time: {new Date(booking.checkOutTime).toLocaleString()}
                    </p>
                    <p className="text-gray-700">
                      By: {booking.checkOutBy === 'instructor' ? booking.instructor.name : booking.client.name}
                    </p>
                    {booking.actualDuration && (
                      <p className="text-gray-700 font-medium">
                        Actual Duration: {booking.actualDuration} minutes
                      </p>
                    )}
                    {booking.checkOutLocation && (
                      <p className="text-gray-600 text-xs">
                        Location: {booking.checkOutLocation}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Not checked out yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Check-in/Check-out Actions */}
        {booking.status === 'CONFIRMED' && !isPast && (
          <div className="bg-white rounded-lg shadow mb-4">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              
              {!booking.checkInTime && isActive && (
                <CheckInOutButton 
                  bookingId={booking.id} 
                  type="check-in"
                  isCheckedIn={!!booking.checkInTime}
                />
              )}

              {booking.checkInTime && !booking.checkOutTime && (
                <CheckInOutButton 
                  bookingId={booking.id} 
                  type="check-out"
                  isCheckedIn={!!booking.checkInTime}
                  isCheckedOut={!!booking.checkOutTime}
                />
              )}

              {!isActive && !booking.checkInTime && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-yellow-800">
                    Check-in will be available when the lesson starts
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-block px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
