import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClientNav from '@/components/ClientNav';

export const dynamic = 'force-dynamic';

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // ✅ SECURITY: Only CLIENT role can access client dashboard
  // Admins and instructors should NOT have access to client routes
  if (session.user.role !== 'CLIENT') {
    // Redirect based on their actual role
    if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
      redirect('/admin')
    } else if (session.user.role === 'INSTRUCTOR') {
      redirect('/dashboard')
    } else {
      redirect('/login')
    }
  }

  return (
    <>
      <ClientNav />
      {children}
    </>
  );
}
