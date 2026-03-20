/**
 * Geocoding via OpenStreetMap Nominatim (free, no API key).
 * Rate limit: 1 req/sec — fine for server-side use.
 */

export interface LatLng { lat: number; lng: number }

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const CACHE = new Map<string, LatLng | null>();

export async function geocode(address: string): Promise<LatLng | null> {
  const key = address.toLowerCase().trim();
  if (CACHE.has(key)) return CACHE.get(key)!;

  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=au`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DriveBook/1.0 (contact@drivebook.com.au)' },
      next: { revalidate: 86400 }, // cache 24h in Next.js fetch cache
    });
    if (!res.ok) { CACHE.set(key, null); return null; }
    const data = await res.json();
    if (!data?.length) { CACHE.set(key, null); return null; }
    const result: LatLng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    CACHE.set(key, result);
    return result;
  } catch {
    CACHE.set(key, null);
    return null;
  }
}

/**
 * Haversine distance in kilometres between two lat/lng points.
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg: number) { return (deg * Math.PI) / 180; }
