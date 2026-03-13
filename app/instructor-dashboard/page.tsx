import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function InstructorDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'INSTRUCTOR') {
    redirect('/login');
  }

  // Redirect to the actual dashboard
  redirect('/dashboard');
}
