import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import InstructorApprovalList from '@/components/admin/InstructorApprovalList';
import AdminNav from '@/components/admin/AdminNav';
import InstructorStatusFilter from '@/components/admin/InstructorStatusFilter';
import AdminInstructorRisk from '@/components/admin/AdminInstructorRisk';

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

  // Funnel counts — always across all instructors regardless of filter
  const [
    totalCount,
    emailVerifiedCount,
    pendingCount,
    approvedCount,
    firstBookingCount,
  ] = await Promise.all([
    prisma.instructor.count(),
    prisma.instructor.count({ where: { user: { emailVerified: true } } }),
    prisma.instructor.count({ where: { approvalStatus: 'PENDING' } }),
    prisma.instructor.count({ where: { approvalStatus: 'APPROVED' } }),
    // Instructors who have at least one completed booking
    prisma.instructor.count({ where: { bookings: { some: { status: 'COMPLETED' } } } }),
  ]);

  // Count instructors who have uploaded at least one document
  const docsUploadedCount = await prisma.instructor.count({
    where: {
      OR: [
        { licenseImageFront: { not: null } },
        { licenseImageBack: { not: null } },
        { insurancePolicyDoc: { not: null } },
        { policeCheckDoc: { not: null } },
        { wwcCheckDoc: { not: null } },
      ],
    },
  });

  const funnel = {
    registered: totalCount,
    emailVerified: emailVerifiedCount,
    docsUploaded: docsUploadedCount,
    approved: approvedCount,
    firstBooking: firstBookingCount,
  };

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
      // Readiness: documents
      licenseNumber: true,
      licenseExpiry: true,
      licenseImageFront: true,
      licenseImageBack: true,
      insuranceNumber: true,
      insuranceExpiry: true,
      insurancePolicyDoc: true,
      policeCheckDoc: true,
      wwcCheckDoc: true,
      documentsVerified: true,
      // Readiness: profile completeness
      baseAddress: true,
      hourlyRate: true,
      workingHours: true,
      // Readiness: payments
      stripeAccountId: true,
      chargesEnabled: true,
      // Display fields
      serviceAreas: true,
      averageRating: true,
      isActive: true,
      user: {
        select: {
          id: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          termsAcceptedAt: true,
        }
      },
      _count: { select: { bookings: true } },
    },
    orderBy: [
      { approvalStatus: 'asc' },
      { id: 'desc' },
    ],
  }) as any;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Instructor Management</h1>
          <p className="mt-1 text-sm text-slate-400">Review and manage instructor applications</p>
        </div>

        {/* ── Activation funnel ─────────────────────────────────────────────── */}
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Instructor Activation Funnel
          </p>
          <div className="flex items-center gap-0 flex-wrap">
            {([
              { label: 'Registered',     value: funnel.registered,     color: 'text-slate-300' },
              { label: 'Email verified', value: funnel.emailVerified,   color: 'text-blue-400'  },
              { label: 'Docs uploaded',  value: funnel.docsUploaded,    color: 'text-violet-400'},
              { label: 'Approved',       value: funnel.approved,        color: 'text-green-400' },
              { label: 'First booking',  value: funnel.firstBooking,    color: 'text-emerald-400'},
            ] as const).map((step, i, arr) => (
              <div key={step.label} className="flex items-center">
                <div className="text-center px-3 py-1">
                  <p className={`text-2xl font-bold ${step.color}`}>{step.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">{step.label}</p>
                  {i > 0 && funnel.registered > 0 && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      {Math.round((step.value / funnel.registered) * 100)}%
                    </p>
                  )}
                </div>
                {i < arr.length - 1 && (
                  <span className="text-slate-700 text-lg px-1 select-none">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pending approval alert */}
        {pendingCount > 0 && status !== 'pending' && (
          <div className="mb-4 bg-amber-900/20 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl font-bold text-amber-600">{pendingCount}</span>
            <div className="flex-1">
              <p className="text-amber-200 font-semibold text-sm">
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

        {/* Risk Monitor */}
        {(status === 'all' || status === 'approved') && (
          <div className="mt-6 mb-6">
            <AdminInstructorRisk />
          </div>
        )}

        <InstructorApprovalList instructors={instructors} />
      </div>
    </div>
  );
}
