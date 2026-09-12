/**
 * ABN Verification — Layer 2: ABR API
 *
 * Validates ABN checksum (Layer 1) then calls the Australian Business Register
 * to confirm the ABN is active and returns the entity name for ownership matching.
 *
 * Requires ABR_GUID in .env — register free at:
 * https://abr.business.gov.au/Tools/WebServices
 */
import { NextRequest, NextResponse } from 'next/server';
import { isValidABNFormat, isNameMatch, NAME_MATCH_AUTO_APPROVE_THRESHOLD, NAME_MATCH_REVIEW_THRESHOLD } from '@/lib/utils/abn-validation';

export const dynamic = 'force-dynamic';

const ABR_GUID = process.env.ABR_GUID ?? '';
const ABR_URL = 'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/SearchByABNv202001';

export async function POST(req: NextRequest) {
  const { abn, instructorName } = await req.json();
  if (!abn) return NextResponse.json({ valid: false, error: 'ABN required' }, { status: 400 });

  const cleaned = abn.replace(/[\s-]/g, '');

  // Layer 1: checksum
  if (!isValidABNFormat(cleaned)) {
    return NextResponse.json({ valid: false, error: 'Invalid ABN — checksum failed' });
  }

  // No GUID configured — return checksum-only result (dev/staging fallback)
  if (!ABR_GUID) {
    return NextResponse.json({
      valid: true,
      abnStatus: 'UNVERIFIED',
      entityName: null,
      gstRegistered: false,
      warning: 'ABR_GUID not configured — checksum only, not government-verified',
    });
  }

  try {
    const url = `${ABR_URL}?searchString=${cleaned}&includeHistoricalDetails=N&authenticationGuid=${ABR_GUID}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DriveBook/1.0 (contact@drivebook.com.au)' },
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`ABR HTTP ${res.status}`);

    const xml = await res.text();

    // Parse key fields from XML response
    // ABR uses <entityStatusCode>Active</entityStatusCode> (not <abnStatus>)
    const entityStatusCode = extractXml(xml, 'entityStatusCode') ?? 'UNKNOWN';
    const isActive = entityStatusCode === 'Active';

    // Entity name: try organisation name first, fall back to individual name
    // For individuals: <givenName> and <familyName> are inside <legalName>
    const orgName = extractXml(xml, 'organisationName');
    const givenName = extractXml(xml, 'givenName');
    const familyName = extractXml(xml, 'familyName');
    const entityName = orgName ?? (givenName || familyName
      ? [givenName, familyName].filter(Boolean).join(' ')
      : null);

    // GST: ABR returns <goodsAndServicesTax><effectiveFrom>...</effectiveFrom></goodsAndServicesTax>
    // when registered, or omits the element entirely when not registered
    const gstRegistered = xml.includes('<goodsAndServicesTax>') && !xml.includes('<goodsAndServicesTax/>') && !xml.includes('<goodsAndServicesTax />');

    // Name match (Layer 3) — only if instructorName provided
    let nameMatchScore: number | null = null;
    let nameMatchStatus: 'MATCHED' | 'REVIEW_REQUIRED' | 'NO_MATCH' | null = null;
    if (instructorName && entityName) {
      const { score } = isNameMatch(instructorName, entityName);
      nameMatchScore = score;
      if (score >= NAME_MATCH_AUTO_APPROVE_THRESHOLD) {
        nameMatchStatus = 'MATCHED';
      } else if (score >= NAME_MATCH_REVIEW_THRESHOLD) {
        nameMatchStatus = 'REVIEW_REQUIRED';
      } else {
        nameMatchStatus = 'NO_MATCH';
      }
    }

    console.log('[abn/verify] nameMatch — status:', nameMatchStatus, '| score:', nameMatchScore);
    return NextResponse.json({
      valid: isActive,
      abnStatus: isActive ? 'ACTIVE' : 'CANCELLED',
      entityName,
      gstRegistered,
      nameMatchScore,
      nameMatchStatus,
    });
  } catch (err) {
    console.error('ABR API error:', err);
    // Don't block the instructor — return degraded result, admin can manually verify
    return NextResponse.json(
      { valid: false, error: 'ABR verification service unavailable — try again shortly' },
      { status: 503 },
    );
  }
}

function extractXml(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`));
  return match?.[1]?.trim() || null;
}
