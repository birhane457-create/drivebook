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

  // Instructor dashboard
  if (session.user.role === 'INSTRUCTOR' || session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
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

  redirect('/login')
}

