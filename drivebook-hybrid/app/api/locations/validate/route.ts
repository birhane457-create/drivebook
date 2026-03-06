import { NextRequest, NextResponse } from 'next/server';
import { geocodeAddress } from '@/lib/utils/distance';

export const dynamic = 'force-dynamic';

/**
 * POST /api/locations/validate
 * Validates and geocodes a pickup location
 * Prevents bad addresses during voice calls
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pickupLocation } = body;

    if (!pickupLocation || typeof pickupLocation !== 'string') {
      return NextResponse.json(
        { 
          valid: false,
          error: 'pickupLocation is required and must be a string' 
        },
        { status: 400 }
      );
    }

    // Attempt to geocode the address
    const coords = await geocodeAddress(pickupLocation);

    if (!coords) {
      return NextResponse.json({
        valid: false,
        error: 'Location not found',
        message: 'Could not find this address. Please provide a more specific location.',
        suggestions: [
          'Include suburb and state (e.g., "Joondalup WA")',
          'Use a postcode (e.g., "6027")',
          'Provide a full street address',
        ],
      });
    }

    // Location is valid
    return NextResponse.json({
      valid: true,
      formattedAddress: coords.displayName,
      lat: coords.lat,
      lng: coords.lng,
      components: {
        suburb: extractSuburb(coords.displayName),
        state: extractState(coords.displayName),
        postcode: extractPostcode(coords.displayName),
      },
    });
  } catch (error) {
    console.error('Location validation error:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Failed to validate location',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to extract suburb from formatted address
 */
function extractSuburb(address: string): string | null {
  // Australian address format: "Street, Suburb, State Postcode"
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return null;
}

/**
 * Helper function to extract state from formatted address
 */
function extractState(address: string): string | null {
  // Look for Australian state codes
  const stateMatch = address.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/);
  return stateMatch ? stateMatch[1] : null;
}

/**
 * Helper function to extract postcode from formatted address
 */
function extractPostcode(address: string): string | null {
  // Australian postcodes are 4 digits
  const postcodeMatch = address.match(/\b(\d{4})\b/);
  return postcodeMatch ? postcodeMatch[1] : null;
}
