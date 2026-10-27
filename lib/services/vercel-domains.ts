/**
 * Vercel domain attachment utility
 *
 * Extracted from app/api/instructor/domain/verify/route.ts for testability.
 *
 * WLA-006 FIX: `domain_already_in_use` means the domain is attached to a
 * DIFFERENT Vercel project — this must NOT be treated as success. The previous
 * code returned `{ success: true }` for both `domain_already_in_use` and
 * `domain_already_exists`, allowing a domain already on another project to be
 * falsely marked as verified on this project.
 */

export interface VercelDomainResult {
  success: boolean;
  error?: string;
  alreadyOnThisProject?: boolean;
}

/**
 * Add a domain to the configured Vercel project via the Vercel API.
 *
 * @param domain  The domain to attach (e.g. "example.com")
 * @returns Result indicating whether the domain was successfully attached.
 *          `alreadyOnThisProject` is true if the domain was already on this
 *          project (a benign condition, not an error).
 */
export async function addDomainToVercel(domain: string): Promise<VercelDomainResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    const missing = [!token && 'VERCEL_API_TOKEN', !projectId && 'VERCEL_PROJECT_ID'].filter(Boolean).join(', ');
    console.warn(`[vercel-domains] Skipping Vercel auto-add — missing env vars: ${missing}`);
    return { success: false, error: `Missing env vars: ${missing}` };
  }

  const url = `https://api.vercel.com/v10/projects/${projectId}/domains${teamId ? `?teamId=${teamId}` : ''}`;
  console.log(`[vercel-domains] Calling Vercel API: POST ${url} domain=${domain}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });

    const data = await res.json();
    console.log(`[vercel-domains] Vercel API response ${res.status}:`, JSON.stringify(data));

    // 200 OK — domain successfully added to this project
    if (res.ok) return { success: true };

    // WLA-006 FIX: domain_already_in_use means the domain is on ANOTHER project.
    // This must NOT be treated as success — traffic will route to the other project.
    if (data.error?.code === 'domain_already_in_use') {
      console.warn(`[vercel-domains] Domain ${domain} is already attached to another Vercel project`);
      return {
        success: false,
        error: 'This domain is already attached to another Vercel project. Contact support to resolve the conflict.',
      };
    }

    // domain_already_exists — may already be on this project (benign) or another.
    // The Vercel API returns this when the domain already exists in the project's
    // domain list. We treat this as success with a flag so the caller knows it
    // was already present (not newly added).
    if (data.error?.code === 'domain_already_exists') {
      console.log(`[vercel-domains] Domain ${domain} already exists in project config`);
      return { success: true, alreadyOnThisProject: true };
    }

    return { success: false, error: data.error?.message || `Vercel API error ${res.status}` };
  } catch (err) {
    console.error('[vercel-domains] Vercel API call failed:', err);
    return { success: false, error: 'Vercel API unreachable' };
  }
}
