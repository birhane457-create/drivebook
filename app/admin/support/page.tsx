import { redirect } from 'next/navigation';
import { checkPermission } from '@/lib/rbac/checkPermission'
import { PERM } from '@/lib/rbac/permissions'
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import { Search, User, GraduationCap, Shield } from 'lucide-react';
import { AdminPageLayout } from '@/components/ui'

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  const permCheck = await checkPermission(session, PERM.ENGAGEMENT_SUPPORT_VIEW)
  if (!permCheck.allowed) redirect('/admin')

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
        provider: { select: { approvalStatus: true, subscriptionTier: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }

  const roleIcon = (role: string) => {
    if (role === 'provider') return <GraduationCap className="w-4 h-4 text-blue-500" />;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return <Shield className="w-4 h-4 text-purple-500" />;
    return <User className="w-4 h-4 text-muted-foreground/60" />;
  };

  const roleColor = (role: string) => {
    if (role === 'provider') return 'bg-blue-900/40 text-primary';
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'bg-violet-900/40 text-violet-300';
    return 'bg-secondary text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Support Centre" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'T' }]}>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Support Centre</h1>
        <p className="text-muted-foreground/60 text-sm mb-6">Search for a user to view their account, send messages, reset passwords, or add wallet credits.</p>

        {/* Search */}
        <form method="GET" className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                autoFocus
              />
            </div>
            <button type="submit"
              className="px-5 py-3 bg-primary text-foreground text-sm font-semibold rounded-xl hover:bg-primary/90">
              Search
            </button>
          </div>
        </form>

        {/* Results */}
        {q.length >= 2 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {users.length === 0 ? (
              <div className="px-5 py-10 text-center text-muted-foreground/60">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No users found for "{q}"</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map(u => (
                  <Link key={u.id} href={`/admin/support/user/${u.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-secondary transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
                        {roleIcon(u.role)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{u.name || '(no name)'}</p>
                        <p className="text-xs text-muted-foreground/60">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                      {u.provider && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          u.provider.approvalStatus === 'APPROVED' ? 'bg-green-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-300'
                        }`}>
                          {u.provider.approvalStatus}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground/60">
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
              className="bg-card rounded-xl border border-border border border-border shadow-sm p-5 hover:shadow-md transition">
              <GraduationCap className="w-6 h-6 text-amber-500 mb-2" />
              <p className="font-semibold text-foreground">Pending Instructors</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Review and approve applications</p>
            </Link>
            <Link href="/admin/clients"
              className="bg-card rounded-xl border border-border border border-border shadow-sm p-5 hover:shadow-md transition">
              <User className="w-6 h-6 text-blue-500 mb-2" />
              <p className="font-semibold text-foreground">All Clients</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Manage student accounts and wallets</p>
            </Link>
            <Link href="/admin/bookings"
              className="bg-card rounded-xl border border-border border border-border shadow-sm p-5 hover:shadow-md transition">
              <Search className="w-6 h-6 text-purple-500 mb-2" />
              <p className="font-semibold text-foreground">All Bookings</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Find and manage any booking</p>
            </Link>
          </div>
        )}
      </div>
    </AdminPageLayout>
    </div>
  )
}
