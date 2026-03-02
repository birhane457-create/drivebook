import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Car, Star, Clock, DollarSign, ArrowLeft } from 'lucide-react'
import BulkBookingForm from '@/components/BulkBookingForm'
import CarImageModal from '@/components/CarImageModal'

export default async function PublicBookingPage({ 
  params,
  searchParams 
}: { 
  params: { instructorId: string }
  searchParams: { location?: string }
}) {
  const instructor = await prisma.instructor.findUnique({
    where: { id: params.instructorId },
    include: {
      serviceAreas: {
        where: { isActive: true },
        orderBy: { postcode: 'asc' }
      }
    }
  })

  if (!instructor) {
    notFound()
  }

  // Check if branding is enabled for PRO/BUSINESS tier
  const hasBranding = 
    (instructor as any).showBrandingOnBookingPage &&
    (instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS');

  const brandLogo = hasBranding ? (instructor as any).brandLogo : null;
  const primaryColor = hasBranding && (instructor as any).brandColorPrimary ? (instructor as any).brandColorPrimary : '#3B82F6';
  const secondaryColor = hasBranding && (instructor as any).brandColorSecondary ? (instructor as any).brandColorSecondary : '#10B981';

  const searchedLocation = searchParams.location || null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/book" className="flex items-center text-gray-700 hover:text-blue-600">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span className="font-medium">Back to Search</span>
            </Link>
            <div className="flex items-center">
              {brandLogo ? (
                <Image
                  src={brandLogo}
                  alt={`${instructor.name} Logo`}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              ) : (
                <>
                  <Car className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                  <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900">DriveBook</span>
                </>
              )}
            </div>
            <Link href="/login" className="text-gray-700 hover:text-blue-600 text-sm sm:text-base">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Instructor Profile */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-24">
              {/* Profile Image */}
              <div className="text-center mb-6">
                {instructor.profileImage ? (
                  <Image
                    src={instructor.profileImage}
                    alt={instructor.name}
                    width={150}
                    height={150}
                    className="rounded-full mx-auto object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-400">
                      {instructor.name.charAt(0)}
                    </span>
                  </div>
                )}
                <h1 className="text-2xl font-bold mt-4">{instructor.name}</h1>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-2 text-gray-600">(4.9)</span>
                </div>
              </div>

              {/* Bio */}
              {instructor.bio && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">About</h3>
                  <p className="text-gray-600 text-sm">{instructor.bio}</p>
                </div>
              )}

              {/* Details and Car Image Side by Side */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Left Column: Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                    <span className="font-semibold" style={{ color: secondaryColor }}>
                      ${instructor.hourlyRate}/hour
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="h-5 w-5 text-gray-400" />
                    <span className="text-xs">{instructor.vehicleTypes.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-xs">Flexible hours</span>
                  </div>
                </div>

                {/* Right Column: Car Image */}
                {instructor.carImage && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm">Training Vehicle</h3>
                    <CarImageModal
                      carImage={instructor.carImage}
                      carMake={instructor.carMake}
                      carModel={instructor.carModel}
                      carYear={instructor.carYear}
                    />
                  </div>
                )}
              </div>

              {/* Car Details Below */}
              {instructor.carImage && (instructor.carMake || instructor.carModel) && (
                <p className="text-sm text-gray-600 mb-6">
                  {instructor.carMake} {instructor.carModel} {instructor.carYear}
                </p>
              )}

              {/* Service Areas */}
              {instructor.serviceAreas.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Service Areas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {instructor.serviceAreas.map((area) => (
                      <span
                        key={area.id}
                        className="px-3 py-1 rounded-full text-sm text-white"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        {area.postcode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-2">
            {searchedLocation && (
              <div className="border-2 rounded-lg p-4 mb-6" style={{ 
                backgroundColor: `${primaryColor}10`, 
                borderColor: `${primaryColor}40` 
              }}>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5" style={{ color: primaryColor }} />
                  <div>
                    <p className="font-semibold text-gray-900">
                      Searching for lessons in: {searchedLocation}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {instructor.name} services this area. Enter your exact pickup address below.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Calendar className="h-6 w-6" style={{ color: primaryColor }} />
                Book Your Lessons
              </h2>
              <p className="text-gray-600 mb-6">
                Choose a package and save up to 12% on bulk bookings
              </p>
              <BulkBookingForm 
                instructorId={instructor.id}
                instructorName={instructor.name}
                hourlyRate={instructor.hourlyRate}
                searchedLocation={searchedLocation}
                brandColorPrimary={primaryColor}
                brandColorSecondary={secondaryColor}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
