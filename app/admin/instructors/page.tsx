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

  const instructors = await prisma.instructor.findMany({
    where: whereClause,
    include: {
      user: { select: { email: true } },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  }) as any;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Instructor Management</h1>
          <p className="mt-1 text-sm text-gray-600">Review and manage instructor applications</p>
        </div>

        <InstructorStatusFilter currentStatus={status} />

        <InstructorApprovalList instructors={instructors} />
      </div>
    </div>
  );
}
