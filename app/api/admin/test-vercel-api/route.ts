import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.PLATFORM_SETTINGS_VIEW);
  if (deny) return deny;

  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return NextResponse.json({
      configured: false,
      missing: [!token && 'VERCEL_API_TOKEN', !projectId && 'VERCEL_PROJECT_ID'].filter(Boolean),
      message: 'Set these in Vercel Dashboard → your project → Settings → Environment Variables',
    });
  }

  try {
    const url = `https://api.vercel.com/v10/projects/${projectId}/domains${teamId ? `?teamId=${teamId}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({
        configured: true,
        working: false,
        status: res.status,
        error: data.error?.message || 'API call failed',
        hint: res.status === 403 ? 'Token may lack permissions — create a new token with Full Account scope' : undefined,
      });
    }

    return NextResponse.json({
      configured: true,
      working: true,
      projectId,
      teamId: teamId || '(personal account)',
      domainCount: data.domains?.length ?? 0,
      domains: (data.domains ?? []).slice(0, 5).map((d: any) => d.name),
    });
  } catch (err: any) {
    return NextResponse.json({ configured: true, working: false, error: err.message });
  }
}
