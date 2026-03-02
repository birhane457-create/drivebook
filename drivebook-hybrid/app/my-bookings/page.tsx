import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Calendar, Clock, MapPin, User, Phone, Mail, ArrowLeft, Car } from 'lucide-react';

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'CLIENT') {
    redirect('/login');
  }

  // Get client record
  const client = await prisma.client.findFirst({
    where: { userId: session.user.id },
    include: {
      bookings: {
        include: {
          instructor: {
            select: {
              name: true,
              phone: true,
              profileImage: true,
              carMake: true,
              carModel: true,
              user: {
                select: {
                  email: true
                }
              }
            }
          }
        },
        orderBy: { startTime: 'desc' }
      }
    }
  });

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No bookings found</h1>
          <Link href="/book" className="text-blue-600 hover:text-blue-700">
            Book your first lesson
          </Link>
        </div>
      </div>
    );
  }

  const upcomingBookings = client.bookings.filter(b => 
    new Date(b.startTime) > new Date() && b.status !== 'CANCELLED'
  );
  
  const pastBookings = client.bookings.filter(b => 
    new Date(b.startTime) <= new Date() || b.status === 'CANCELLED'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/book" className="flex items-center text-gray-700 hover:text-blue-600">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span className="font-medium">Book Another Lesson</span>
            </Link>
            <div className="flex items-center">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900">DriveBook</span>
            </div>
            <Link href="/api/auth/signout" className="text-red-600 hover:text-red-700 text-sm sm:text-base">
              Logout
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
          <p className="text-gray-600">Welcome back, {client.name}!</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>{client.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>{client.phone}</span>
            </div>
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Upcoming Lessons</h2>
          {upcomingBookings.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No upcoming lessons</p>
              <Link 
                href="/book"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Book a Lesson
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{booking.instructor.name}</h3>
                      <p className="text-sm text-gray-600">
                        {booking.instructor.carMake} {booking.instructor.carModel}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                      booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <span>{new Date(booking.startTime).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <span>
                        {new Date(booking.startTime).toLocaleTimeString('en-AU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} - {new Date(booking.endTime).toLocaleTimeString('en-AU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <span>{booking.pickupAddress}</span>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <span>{booking.instructor.phone}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <span className="text-2xl font-bold text-blue-600">
                      ${booking.price.toFixed(2)}
                    </span>
                    {booking.status === 'PENDING' && (
                      <Link
                        href={`/cancel-booking/${booking.id}`}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Cancel Booking
                      </Link>
                    )}
                  </div>

                  {booking.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                      <p className="font-medium text-gray-700 mb-1">Notes:</p>
                      <p className="text-gray-600">{booking.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Past Lessons</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pastBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(booking.startTime).toLocaleDateString('en-AU')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {booking.instructor.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          ${booking.price.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
