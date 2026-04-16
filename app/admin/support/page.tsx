import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import { Search, User, GraduationCap, Shield } from 'lucide-react';

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    redirect('/login');
  }

  const q = searchParams.q?.trim() || '';

  let users: any[] = [];
  if (q.length >= 2) {
    users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        instructor: { select: { approvalStatus: true, subscriptionTier: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }

  const roleIcon = (role: string) => {
    if (role === 'INSTRUCTOR') return <GraduationCap className="w-4 h-4 text-blue-500" />;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Shield className="w-4 h-4 text-purple-500" />;
    return <User className="w-4 h-4 text-gray-400" />;
  };

  const roleColor = (role: string) => {
    if (role === 'INSTRUCTOR') return 'bg-blue-100 text-blue-700';
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Support Centre</h1>
        <p className="text-gray-500 text-sm mb-6">Search for a user to view their account, send messages, reset passwords, or add wallet credits.</p>

        {/* Search */}
        <form method="GET" className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>
            <button type="submit"
              className="px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
              Search
            </button>
          </div>
        </form>

        {/* Results */}
        {q.length >= 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {users.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No users found for "{q}"</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map(u => (
                  <Link key={u.id} href={`/admin/support/user/${u.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                        {roleIcon(u.role)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{u.name || '(no name)'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                      {u.instructor && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          u.instructor.approvalStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {u.instructor.approvalStatus}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {!q && (
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <Link href="/admin/instructors?status=PENDING"
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <GraduationCap className="w-6 h-6 text-amber-500 mb-2" />
              <p className="font-semibold text-gray-900">Pending Instructors</p>
              <p className="text-xs text-gray-500 mt-1">Review and approve applications</p>
            </Link>
            <Link href="/admin/clients"
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <User className="w-6 h-6 text-blue-500 mb-2" />
              <p className="font-semibold text-gray-900">All Clients</p>
              <p className="text-xs text-gray-500 mt-1">Manage student accounts and wallets</p>
            </Link>
            <Link href="/admin/bookings"
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
              <Search className="w-6 h-6 text-purple-500 mb-2" />
              <p className="font-semibold text-gray-900">All Bookings</p>
              <p className="text-xs text-gray-500 mt-1">Find and manage any booking</p>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
