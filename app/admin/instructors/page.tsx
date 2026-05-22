import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import InstructorApprovalList from '@/components/admin/InstructorApprovalList';
import AdminNav from '@/components/admin/AdminNav';
import InstructorStatusFilter from '@/components/admin/InstructorStatusFilter';

export default async function AdminInstructorsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const status = searchParams.status || 'all';

  const whereClause: any = {};
  if (status !== 'all') {
    whereClause.approvalStatus = status.toUpperCase();
  }

  // Count pending instructors for the alert badge (always, regardless of filter)
  const pendingCount = await prisma.instructor.count({
    where: { approvalStatus: 'PENDING' },
  });

  const instructors = await prisma.instructor.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      phone: true,
      bio: true,
      profileImage: true,
      approvalStatus: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      licenseNumber: true,
      licenseExpiry: true,
      insuranceNumber: true,
      insuranceExpiry: true,
      documentsVerified: true,
      hourlyRate: true,
      serviceAreas: true,
      baseAddress: true,
      averageRating: true,
      isActive: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          termsAcceptedAt: true,
        }
      },
      _count: { select: { bookings: true, reviews: true } },
    },
    orderBy: [
      // PENDING first, then by creation date
      { approvalStatus: 'asc' },
      { id: 'desc' },
    ],
  }) as any;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Instructor Management</h1>
          <p className="mt-1 text-sm text-gray-600">Review and manage instructor applications</p>
        </div>

        {/* Pending approval alert */}
        {pendingCount > 0 && status !== 'pending' && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl font-bold text-amber-600">{pendingCount}</span>
            <div className="flex-1">
              <p className="text-amber-900 font-semibold text-sm">
                {pendingCount === 1 ? '1 instructor awaiting approval' : `${pendingCount} instructors awaiting approval`}
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Pending instructors cannot create bookings until approved.
              </p>
            </div>
            <a
              href="/admin/instructors?status=pending"
              className="shrink-0 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-semibold"
            >
              Review Now →
            </a>
          </div>
        )}

        <InstructorStatusFilter currentStatus={status} pendingCount={pendingCount} />

        <InstructorApprovalList instructors={instructors} />
      </div>
    </div>
  );
}
