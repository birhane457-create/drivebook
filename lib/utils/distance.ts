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

/**
 * Geocode an address to coordinates
 * Uses OpenStreetMap Nominatim (free, no API key needed)
 */
export async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  displayName: string;
} | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=au`,
      {
        headers: {
          'User-Agent': 'DriveBook-Platform/1.0'
        }
      }
    );

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
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          'User-Agent': 'DriveBook-Platform/1.0'
        }
      }
    );

    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}
