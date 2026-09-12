import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SubdomainBookingPage from '@/app/subdomain/[slug]/page';
import BusinessWebsitePage from '@/components/website/BusinessWebsitePage';
import { fetchProviderWebsiteData } from '@/lib/website/fetchProviderWebsiteData';

export const dynamic = 'force-dynamic';

/**
 * Custom domain booking page (Studio tier).
 * Middleware rewrites requests from custom domains to /custom-domain
 * and sets the x-custom-domain header.
 *
 * Resolution order:
 *   1. Find provider by their customDomain field
 *   2. If they have custom BusinessConfig → render with generic BusinessWebsitePage
 *   3. Otherwise → render with the driving-specific SubdomainBookingPage (fallback)
 */
export default async function CustomDomainPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const headersList = headers();
  const customDomain = headersList.get('x-custom-domain');
  if (!customDomain) notFound();

  // Find the provider who owns this verified custom domain
  const instructor = await prisma.provider.findFirst({
    where: {
      customDomain,
      domainVerified: true,
      subscriptionTier: { in: ['STUDIO', 'PREMIUM'] },
    },
    select: { id: true, customSlug: true },
  });

  if (!instructor) {
    // Also check BusinessDomain table (for businesses set up via Business Config)
    const bizDomain = await (prisma as any).businessDomain?.findFirst?.({
      where: { host: customDomain, verified: true },
      select: { businessId: true, business: { select: { id: true } } },
    }).catch(() => null)

    if (!bizDomain) notFound()

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au'
    const websiteData = await fetchProviderWebsiteData(bizDomain.businessId, rootDomain)
    if (!websiteData) notFound()

    return <BusinessWebsitePage {...websiteData} canonicalUrl={`https://${customDomain}`} />
  }

  // Try generic renderer first
  try {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au'
    const slug = instructor.customSlug ?? instructor.id
    const websiteData = await fetchProviderWebsiteData(slug, rootDomain)

    if (websiteData) {
      const { config } = websiteData
      const isCustomised =
        config.terminology.provider !== 'provider' ||
        config.terminology.booking !== 'Lesson'
      if (isCustomised) {
        return <BusinessWebsitePage {...websiteData} canonicalUrl={`https://${customDomain}`} />
      }
    }
  } catch { /* fall through */ }

  // Fall back to driving-specific page
  return SubdomainBookingPage({
    params: { slug: instructor.customSlug ?? instructor.id },
    searchParams,
  });
}
