import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SubdomainBookingPage from '@/app/subdomain/[slug]/page';

export const dynamic = 'force-dynamic';

/**
 * Custom domain booking page (Studio tier).
 * Middleware rewrites requests from custom domains to /custom-domain.
 * We read the x-custom-domain header to find the instructor.
 */
export default async function CustomDomainPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const headersList = headers();
  const customDomain = headersList.get('x-custom-domain');

  if (!customDomain) notFound();

  // Verify this domain belongs to a verified Studio/Business instructor
  const instructor = await prisma.instructor.findFirst({
    where: {
      customDomain,
      domainVerified: true,
      subscriptionTier: { in: ['STUDIO', 'BUSINESS'] },
    },
    select: { customDomain: true },
  });

  if (!instructor) notFound();

  // Reuse the subdomain page — it already handles all the rendering
  // We pass the customDomain as the slug (it will look up by customDomain field)
  return SubdomainBookingPage({
    params: { slug: customDomain },
    searchParams,
  });
}
