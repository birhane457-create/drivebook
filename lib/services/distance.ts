import { Loader } from '@googlemaps/js-api-loader'

interface Location {
  latitude: number
  longitude: number
}

interface DistanceResult {
  distanceKm: number
  durationMinutes: number
  feasible: boolean
  extraCharge: number
  reason?: string
}

export class DistanceService {
  private loader: Loader
  private mapsLoaded = false

  constructor() {
    this.loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
      libraries: ['places', 'geometry']
    })
  }

  async calculateDistance(origin: Location, destination: Location): Promise<number> {
    // Haversine formula for distance calculation
    const R = 6371 // Earth's radius in km
    const dLat = this.toRad(destination.latitude - origin.latitude)
    const dLon = this.toRad(destination.longitude - origin.longitude)
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(origin.latitude)) * 
      Math.cos(this.toRad(destination.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  async calculatePickupFeasibility(
    instructorBase: Location,
    clientLocation: Location,
    serviceRadiusKm: number,
    freeRadiusKm: number = 10
  ): Promise<DistanceResult> {
    const distance = await this.calculateDistance(instructorBase, clientLocation)
    
    // Estimate travel time (average 40 km/h in urban areas)
    const durationMinutes = Math.ceil((distance / 40) * 60)

    // Check if within service radius
    if (distance > serviceRadiusKm) {
      return {
        distanceKm: distance,
        durationMinutes,
        feasible: false,
        extraCharge: 0,
        reason: `Outside service area (${serviceRadiusKm}km radius)`
      }
    }

    // Calculate extra charge for distance beyond free radius
    const extraCharge = distance > freeRadiusKm 
      ? (distance - freeRadiusKm) * 2 // $2 per km beyond free radius
      : 0

    return {
      distanceKm: Math.round(distance * 10) / 10,
      durationMinutes,
      feasible: true,
      extraCharge: Math.round(extraCharge * 100) / 100
    }
  }

  async geocodeAddress(address: string): Promise<Location | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location
        return {
          latitude: location.lat,
          longitude: location.lng
        }
      }
      return null
    } catch (error) {
      console.error('Geocoding error:', error)
      return null
    }
  }
}

export const distanceService = new DistanceService()
