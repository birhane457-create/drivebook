import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminMobileBottomNav from '@/components/admin/MobileBottomNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // ✅ SECURITY: Only ADMIN and SUPER_ADMIN roles can access admin area
  // Instructors and clients should NOT have access to admin routes
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    // Redirect based on their actual role
    if (session.user.role === 'INSTRUCTOR') {
      redirect('/dashboard')
    } else if (session.user.role === 'CLIENT') {
      redirect('/client-dashboard')
    } else {
      redirect('/login')
    }
  }

  // Admin has access - render the page with mobile bottom nav
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pb-20 lg:pb-0">
        {children}
      </div>
      <AdminMobileBottomNav />
    </div>
  )
}
