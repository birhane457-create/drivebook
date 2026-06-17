import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Car, Star, ArrowLeft, AlertTriangle } from 'lucide-react'
import BulkBookingForm from '@/components/BulkBookingForm'

export default async function PublicBookingPage({ 
  params,
  searchParams 
}: { 
  params: { instructorId: string }
  searchParams: { location?: string }
}) {
  const instructor = await prisma.instructor.findUnique({
    where: { id: params.instructorId },
  }) as any;
  if (!instructor) notFound();

  // ── Subscription gate for public booking ─────────────────────────────────
  // If the instructor's subscription is inactive, don't show the booking form.
  // Their profile is still visible (so students know they exist) but they
  // cannot accept new bookings until they resubscribe.
  const subStatus = instructor.subscriptionStatus as string;
  const trialEndsAt = instructor.trialEndsAt ? new Date(instructor.trialEndsAt) : null;
  const trialExpired = trialEndsAt && trialEndsAt < new Date();
  const isAcceptingBookings =
    subStatus === 'ACTIVE' ||
    (subStatus === 'TRIAL' && !trialExpired);

  // Check if branding is enabled for PRO/BUSINESS tier
  const hasBranding = 
    (instructor as any).showBrandingOnBookingPage &&
    (instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS');

  const brandLogo = hasBranding ? (instructor as any).brandLogo : null;
  const primaryColor = hasBranding && (instructor as any).brandColorPrimary ? (instructor as any).brandColorPrimary : '#3B82F6';
  const secondaryColor = hasBranding && (instructor as any).brandColorSecondary ? (instructor as any).brandColorSecondary : '#10B981';

  const searchedLocation = searchParams.location || null;

  const allowedDurations: number[] = Array.isArray((instructor as any).allowedDurations)
    ? (instructor as any).allowedDurations as number[]
    : [];

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
            <div className="bg-white rounded-xl shadow-md overflow-hidden sticky top-24">
              {/* Photos: profile + car side by side */}
              <div className="flex">
                <div className="relative w-1/2 h-40 bg-gray-100">
                  {instructor.profileImage ? (
                    <Image src={instructor.profileImage} alt={instructor.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-gray-300">
                      {instructor.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="relative w-1/2 h-40 bg-gray-50">
                  {instructor.carImage ? (
                    <Image src={instructor.carImage} alt="Training vehicle" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Car className="h-12 w-12" />
                    </div>
                  )}
                  {(instructor.carMake || instructor.carModel) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-2 py-1 truncate">
                      {[instructor.carYear, instructor.carMake, instructor.carModel].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5">
                {/* Name + rating */}
                <h1 className="text-xl font-bold text-gray-900">{instructor.name}</h1>
                <div className="flex items-center gap-1 mt-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < Math.round((instructor as any).averageRating ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                  ))}
                  {(instructor as any).totalReviews > 0 ? (
                    <span className="ml-1 text-sm text-gray-500">({(instructor as any).averageRating?.toFixed(1)} · {(instructor as any).totalReviews} reviews)</span>
                  ) : (
                    <span className="ml-1 text-sm text-gray-400">New instructor</span>
                  )}
                </div>

                {/* Bio */}
                {instructor.bio && (
                  <p className="text-sm text-gray-600 mb-4">{instructor.bio}</p>
                )}

                {/* Pricing tiles */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Standard</p>
                    <p className="text-base font-bold text-blue-700" style={{ color: secondaryColor }}>
                      ${instructor.hourlyRate}/hr
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">Bulk packages</p>
                    <p className="text-base font-bold text-green-700">6 / 10 / 15 hrs</p>
                  </div>
                  {instructor.offersTestPackage && (
                    <div className="bg-purple-50 rounded-lg px-3 py-2 col-span-2">
                      <p className="text-xs text-gray-500">PDA test pack</p>
                      <p className="text-base font-bold text-purple-700">
                        {instructor.testPackagePrice ? `$${instructor.testPackagePrice.toFixed(2)}` : 'Available'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Service Areas */}
                {instructor.serviceAreas && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> Service Areas
                    </h3>
                    <p className="text-xs text-gray-500">{instructor.serviceAreas}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-2">
            {!isAcceptingBookings ? (
              /* ── Inactive instructor — not accepting bookings ── */
              <div className="bg-white rounded-xl shadow-md p-8 text-center">
                <AlertTriangle className="h-14 w-14 text-amber-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {instructor.name} is not currently accepting bookings
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  This instructor's account is temporarily inactive. Please check back later or find another instructor.
                </p>
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Find Another Instructor
                </Link>
              </div>
            ) : (
              <>
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
                    serviceAreas={instructor.serviceAreas}
                    baseAddress={instructor.baseAddress}
                    serviceRadiusKm={instructor.serviceRadiusKm}
                    allowedDurations={allowedDurations}
                    offersTestPackage={instructor.offersTestPackage ?? false}
                    testPackagePrice={instructor.testPackagePrice ?? undefined}
                    testPackageDuration={instructor.testPackageDuration ?? undefined}
                    testPackageIncludes={(instructor.testPackageIncludes as string[]) ?? []}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
