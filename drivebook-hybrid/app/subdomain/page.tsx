import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function SubdomainPage() {
  const headersList = headers();
  const subdomain = headersList.get('x-subdomain');

  if (!subdomain) {
    // No subdomain, redirect to main page
    redirect('/');
  }

  try {
    // Look up instructor by subdomain
    const instructor = await prisma.instructor.findFirst({
      where: { customDomain: subdomain },
      select: { id: true },
    });

    if (instructor) {
      // Redirect to instructor's booking page
      redirect(`/book/${instructor.id}`);
    }

    // Subdomain not found, redirect to main page
    redirect('/');
  } catch (error) {
    console.error('Error looking up subdomain:', error);
    redirect('/');
  }
}
