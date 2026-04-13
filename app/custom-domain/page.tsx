import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SubdomainBookingPage from '@/app/subdomain/[slug]/page';

export const dynamic = 'force-dynamic';

/**
 * Custom domain booking page (Studio tier).
 * Middleware rewrites requests from custom domains to /custom-domain
 * and sets the x-custom-domain header.
 *
 * We look up the instructor by their customDomain field, then render
 * the standard subdomain booking page using the instructor's ID as the slug.
 */
export default async function CustomDomainPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const headersList = headers();
  const customDomain = headersList.get('x-custom-domain');

  if (!customDomain) notFound();

  // Find the instructor who owns this verified custom domain
  const instructor = await prisma.instructor.findFirst({
    where: {
      customDomain,
      domainVerified: true,
      subscriptionTier: { in: ['STUDIO', 'BUSINESS'] },
    },
    select: { id: true },
  });

  if (!instructor) notFound();

  // Render the standard booking page using the instructor's ID as the slug.
  // The subdomain page falls back to ID lookup, so this always resolves correctly
  // regardless of whether the instructor has a customSlug set.
  return SubdomainBookingPage({
    params: { slug: instructor.id },
    searchParams,
  });
}
