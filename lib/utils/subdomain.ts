/**
 * Subdomain Utilities
 * 
 * Handles subdomain extraction and routing for custom instructor subdomains
 */

/**
 * Extract subdomain from hostname
 * @param hostname - Full hostname (e.g., "john.drivebook.com")
 * @returns Subdomain or null if not a subdomain
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];
  
  // Split by dots
  const parts = host.split('.');
  
  // If localhost or IP, no subdomain
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  
  // If only 2 parts (e.g., "drivebook.com"), no subdomain
  if (parts.length <= 2) {
    return null;
  }
  
  // If 3+ parts, first part is subdomain (e.g., "john.drivebook.com" → "john")
  const subdomain = parts[0];
  
  // Ignore www
  if (subdomain === 'www') {
    return null;
  }
  
  return subdomain;
}

/**
 * Check if hostname is a custom subdomain
 * @param hostname - Full hostname
 * @returns True if custom subdomain, false otherwise
 */
export function isCustomSubdomain(hostname: string): boolean {
  const subdomain = extractSubdomain(hostname);
  return subdomain !== null;
}

/**
 * Get instructor ID from subdomain
 * @param subdomain - Subdomain string
 * @returns Instructor ID or null
 */
export async function getInstructorBySubdomain(subdomain: string): Promise<string | null> {
  try {
    const { prisma } = await import('@/lib/prisma');
    
    const instructor = await prisma.instructor.findFirst({
      where: { customDomain: subdomain },
      select: { id: true },
    });
    
    return instructor?.id || null;
  } catch (error) {
    console.error('Error fetching instructor by subdomain:', error);
    return null;
  }
}

/**
 * Build booking URL for instructor
 * @param instructorId - Instructor ID
 * @param subdomain - Optional custom subdomain
 * @returns Booking URL
 */
export function buildBookingUrl(instructorId: string, subdomain?: string | null): string {
  if (subdomain) {
    return `https://${subdomain}.drivebook.com`;
  }
  return `/book/${instructorId}`;
}
