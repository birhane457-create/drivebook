// Distance and location utilities

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within an instructor's service radius
 */
export function isWithinServiceRadius(
  instructorLat: number,
  instructorLng: number,
  serviceRadiusKm: number,
  clientLat: number,
  clientLng: number
): boolean {
  const distance = calculateDistance(
    instructorLat,
    instructorLng,
    clientLat,
    clientLng
  );
  return distance <= serviceRadiusKm;
}

/**
 * Get bounding box for pre-filtering (performance optimization)
 * Returns rough square area around a point
 */
export function getBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number
) {
  const latRange = radiusKm / 111; // 1 degree ≈ 111km
  const lngRange = radiusKm / (111 * Math.cos(lat * Math.PI/180));
  
  return {
    minLat: lat - latRange,
    maxLat: lat + latRange,
    minLng: lng - lngRange,
    maxLng: lng + lngRange
  };
}

// Fast lookup cache for common WA postcodes — avoids Nominatim latency for the
// most frequently used locations. Nominatim is still used as fallback for anything
// not in this list. Coordinates are suburb centroids (Perth metro + nearby regions).
const WA_POSTCODE_CACHE: Record<string, { lat: number; lng: number; displayName: string }> = {
  '6000': { lat: -31.9505, lng: 115.8605, displayName: 'Perth WA 6000, Australia' },
  '6001': { lat: -31.9505, lng: 115.8605, displayName: 'Perth WA 6001, Australia' },
  '6003': { lat: -31.9419, lng: 115.8634, displayName: 'Northbridge WA 6003, Australia' },
  '6004': { lat: -31.9419, lng: 115.8700, displayName: 'East Perth WA 6004, Australia' },
  '6005': { lat: -31.9600, lng: 115.8450, displayName: 'West Perth WA 6005, Australia' },
  '6006': { lat: -31.9333, lng: 115.8417, displayName: 'North Perth WA 6006, Australia' },
  '6007': { lat: -31.9333, lng: 115.8250, displayName: 'Leederville WA 6007, Australia' },
  '6008': { lat: -31.9500, lng: 115.8083, displayName: 'Subiaco WA 6008, Australia' },
  '6009': { lat: -31.9667, lng: 115.8000, displayName: 'Nedlands WA 6009, Australia' },
  '6010': { lat: -31.9667, lng: 115.7750, displayName: 'Claremont WA 6010, Australia' },
  '6011': { lat: -31.9833, lng: 115.7583, displayName: 'Cottesloe WA 6011, Australia' },
  '6012': { lat: -31.9833, lng: 115.7750, displayName: 'Mosman Park WA 6012, Australia' },
  '6014': { lat: -31.9333, lng: 115.7917, displayName: 'Floreat WA 6014, Australia' },
  '6015': { lat: -31.9250, lng: 115.7667, displayName: 'City Beach WA 6015, Australia' },
  '6016': { lat: -31.9167, lng: 115.8083, displayName: 'Mount Hawthorn WA 6016, Australia' },
  '6017': { lat: -31.9083, lng: 115.8167, displayName: 'Osborne Park WA 6017, Australia' },
  '6018': { lat: -31.8833, lng: 115.7833, displayName: 'Gwelup WA 6018, Australia' },
  '6019': { lat: -31.8833, lng: 115.7667, displayName: 'Scarborough WA 6019, Australia' },
  '6020': { lat: -31.8583, lng: 115.7583, displayName: 'Trigg WA 6020, Australia' },
  '6021': { lat: -31.8667, lng: 115.8083, displayName: 'Balcatta WA 6021, Australia' },
  '6023': { lat: -31.8583, lng: 115.7917, displayName: 'Hamersley WA 6023, Australia' },
  '6024': { lat: -31.8417, lng: 115.8000, displayName: 'Greenwood WA 6024, Australia' },
  '6025': { lat: -31.8167, lng: 115.7833, displayName: 'Hillarys WA 6025, Australia' },
  '6026': { lat: -31.7917, lng: 115.7833, displayName: 'Craigie WA 6026, Australia' },
  '6027': { lat: -31.7667, lng: 115.7750, displayName: 'Joondalup WA 6027, Australia' },
  '6028': { lat: -31.7417, lng: 115.7667, displayName: 'Connolly WA 6028, Australia' },
  '6029': { lat: -31.7250, lng: 115.7583, displayName: 'Currambine WA 6029, Australia' },
  '6030': { lat: -31.6917, lng: 115.7333, displayName: 'Clarkson WA 6030, Australia' },
  '6050': { lat: -31.9167, lng: 115.8583, displayName: 'Inglewood WA 6050, Australia' },
  '6051': { lat: -31.9333, lng: 115.9000, displayName: 'Maylands WA 6051, Australia' },
  '6052': { lat: -31.9167, lng: 115.8917, displayName: 'Bedford WA 6052, Australia' },
  '6053': { lat: -31.9083, lng: 115.9167, displayName: 'Bayswater WA 6053, Australia' },
  '6054': { lat: -31.8917, lng: 115.9333, displayName: 'Bassendean WA 6054, Australia' },
  '6055': { lat: -31.8750, lng: 115.9833, displayName: 'Middle Swan WA 6055, Australia' },
  '6056': { lat: -31.8750, lng: 116.0333, displayName: 'Midland WA 6056, Australia' },
  '6057': { lat: -31.9083, lng: 116.0333, displayName: 'Beechboro WA 6057, Australia' },
  '6058': { lat: -31.9083, lng: 115.9583, displayName: 'Morley WA 6058, Australia' },
  '6059': { lat: -31.8833, lng: 115.8917, displayName: 'Dianella WA 6059, Australia' },
  '6060': { lat: -31.9000, lng: 115.8667, displayName: 'Yokine WA 6060, Australia' },
  '6061': { lat: -31.8833, lng: 115.8583, displayName: 'Mirrabooka WA 6061, Australia' },
  '6062': { lat: -31.8667, lng: 115.8667, displayName: 'Noranda WA 6062, Australia' },
  '6063': { lat: -31.8583, lng: 115.8917, displayName: 'Beechboro WA 6063, Australia' },
  '6064': { lat: -31.8417, lng: 115.8583, displayName: 'Malaga WA 6064, Australia' },
  '6065': { lat: -31.8083, lng: 115.8417, displayName: 'Wanneroo WA 6065, Australia' },
  '6066': { lat: -31.8250, lng: 115.8750, displayName: 'Wangara WA 6066, Australia' },
  '6069': { lat: -31.7750, lng: 116.0083, displayName: 'Ellenbrook WA 6069, Australia' },
  '6076': { lat: -31.9583, lng: 116.1250, displayName: 'Kalamunda WA 6076, Australia' },
  '6100': { lat: -31.9667, lng: 115.9000, displayName: 'East Vic Park WA 6100, Australia' },
  '6101': { lat: -31.9750, lng: 115.9167, displayName: 'Carlisle WA 6101, Australia' },
  '6102': { lat: -31.9833, lng: 115.8833, displayName: 'Rivervale WA 6102, Australia' },
  '6103': { lat: -31.9583, lng: 115.9083, displayName: 'Lathlain WA 6103, Australia' },
  '6104': { lat: -31.9500, lng: 115.9417, displayName: 'Redcliffe WA 6104, Australia' },
  '6105': { lat: -31.9417, lng: 115.9583, displayName: 'Ascot WA 6105, Australia' },
  '6106': { lat: -31.9583, lng: 115.9667, displayName: 'South Guildford WA 6106, Australia' },
  '6107': { lat: -31.9917, lng: 115.9417, displayName: 'Belmont WA 6107, Australia' },
  '6108': { lat: -31.9917, lng: 115.9667, displayName: 'Cloverdale WA 6108, Australia' },
  '6109': { lat: -32.0083, lng: 115.9667, displayName: 'Kewdale WA 6109, Australia' },
  '6110': { lat: -32.0167, lng: 115.9833, displayName: 'Welshpool WA 6110, Australia' },
  '6111': { lat: -32.0583, lng: 116.0083, displayName: 'Forrestfield WA 6111, Australia' },
  '6112': { lat: -32.0833, lng: 116.0250, displayName: 'Maddington WA 6112, Australia' },
  '6147': { lat: -32.0583, lng: 115.9583, displayName: 'Wilson WA 6147, Australia' },
  '6148': { lat: -32.0250, lng: 115.9167, displayName: 'Como WA 6148, Australia' },
  '6149': { lat: -32.0167, lng: 115.8833, displayName: 'Karawara WA 6149, Australia' },
  '6150': { lat: -32.0500, lng: 115.8583, displayName: 'Murdoch WA 6150, Australia' },
  '6151': { lat: -32.0083, lng: 115.8750, displayName: 'South Perth WA 6151, Australia' },
  '6152': { lat: -31.9917, lng: 115.8583, displayName: 'Manning WA 6152, Australia' },
  '6153': { lat: -32.0083, lng: 115.8333, displayName: 'Applecross WA 6153, Australia' },
  '6154': { lat: -32.0250, lng: 115.8167, displayName: 'Myaree WA 6154, Australia' },
  '6155': { lat: -32.0833, lng: 115.8667, displayName: 'Harrisdale WA 6155, Australia' },
  '6156': { lat: -32.0333, lng: 115.7917, displayName: 'Bicton WA 6156, Australia' },
  '6157': { lat: -32.0417, lng: 115.7667, displayName: 'Fremantle WA 6157, Australia' },
  '6158': { lat: -32.0583, lng: 115.7500, displayName: 'North Fremantle WA 6158, Australia' },
  '6159': { lat: -32.0750, lng: 115.7583, displayName: 'White Gum Valley WA 6159, Australia' },
  '6160': { lat: -32.0583, lng: 115.7417, displayName: 'Fremantle WA 6160, Australia' },
  '6162': { lat: -32.0917, lng: 115.7667, displayName: 'Hamilton Hill WA 6162, Australia' },
  '6163': { lat: -32.1083, lng: 115.7917, displayName: 'Spearwood WA 6163, Australia' },
  '6164': { lat: -32.1250, lng: 115.8333, displayName: 'Jandakot WA 6164, Australia' },
  '6165': { lat: -32.1500, lng: 115.8417, displayName: 'Hammond Park WA 6165, Australia' },
  '6166': { lat: -32.1167, lng: 115.8083, displayName: 'Cockburn Central WA 6166, Australia' },
  '6167': { lat: -32.1583, lng: 115.8667, displayName: 'Atwell WA 6167, Australia' },
  '6168': { lat: -32.2083, lng: 115.8333, displayName: 'Rockingham WA 6168, Australia' },
  '6169': { lat: -32.2500, lng: 115.8000, displayName: 'Shoalwater WA 6169, Australia' },
};

/**
 * Geocode an address to coordinates.
 * Uses a built-in WA postcode cache for instant resolution of Perth metro postcodes,
 * falling back to OpenStreetMap Nominatim for other addresses.
 */
export async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
} | null> {
  try {
    // Fast path: check WA postcode cache first (instant, no network call)
    const trimmed = address.trim();
    if (/^\d{4}$/.test(trimmed) && WA_POSTCODE_CACHE[trimmed]) {
      return WA_POSTCODE_CACHE[trimmed];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=au`,
      {
        headers: {
          'User-Agent': 'DriveBook-Platform/1.0'
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          'User-Agent': 'DriveBook-Platform/1.0'
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
