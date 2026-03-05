import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardNav from '@/components/DashboardNav'
import ClientDashboardNav from '@/components/ClientDashboardNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // ✅ SECURITY: Only INSTRUCTOR role can access instructor dashboard
  // Admins should use /admin routes, not /dashboard routes
  if (session.user.role === 'INSTRUCTOR') {
    if (!session.user.instructorId) {
      redirect('/login')
    }
    
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav />
        {children}
      </div>
    )
  }

  // Client dashboard
  if (session.user.role === 'CLIENT') {
    return (
      <div className="min-h-screen bg-gray-50">
        <ClientDashboardNav />
        {children}
      </div>
    )
  }

  // ✅ SECURITY: Redirect admins to admin area, not instructor dashboard
  if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
    redirect('/admin')
  }

  redirect('/login')
}

