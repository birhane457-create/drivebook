'use client'

import { useSession } from 'next-auth/react'

export interface BusinessTerminology {
  // Customer terminology
  customer: string          // 'Client' | 'Customer'
  customers: string         // 'Clients' | 'Customers'
  customerLowercase: string // 'customer' | 'customer'
  customersLowercase: string // 'clients' | 'customers'
  
  // Service terminology
  service: string           // 'Lesson' | 'Booking' | 'Service'
  services: string          // 'Lessons' | 'Bookings' | 'Services'
  serviceLowercase: string  // 'lesson' | 'booking' | 'service'
  servicesLowercase: string // 'lessons' | 'bookings' | 'services'
  
  // Provider terminology
  provider: string          // 'provider' | 'Provider'
  providers: string         // 'Instructors' | 'Providers'
  providerLowercase: string // 'provider' | 'provider'
  providersLowercase: string // 'instructors' | 'providers'
  
  // Business type
  businessType: string      // 'driving' | 'plumber' | 'electrician' | 'beauty' | 'tax'
  paymentModel: 'marketplace' | 'saas'
  isDriving: boolean
  isMarketplace: boolean
}

/**
 * Hook to get business-specific terminology based on the logged-in provider's business type
 * 
 * @returns BusinessTerminology object with appropriate labels for the business vertical
 * 
 * @example
 * const { customer, customers, service, provider, isDriving } = useBusinessConfig()
 * 
 * // For driving schools:
 * // customer = 'Client', service = 'Lesson', provider = 'provider'
 * 
 * // For trades (plumber, electrician, etc.):
 * // customer = 'Customer', service = 'Booking', provider = 'Provider'
 */
export function useBusinessConfig(): BusinessTerminology {
  const { data: session } = useSession()
  
  const businessType = session?.user?.businessType ?? 'driving'
  const paymentModel = session?.user?.paymentModel ?? 'marketplace'
  const isDriving = businessType === 'driving'
  const isMarketplace = paymentModel === 'marketplace'
  
  // Driving schools use traditional terminology
  if (isDriving) {
    return {
      customer: 'Client',
      customers: 'Clients',
      customerLowercase: 'customer',
      customersLowercase: 'clients',
      
      service: 'Lesson',
      services: 'Lessons',
      serviceLowercase: 'lesson',
      servicesLowercase: 'lessons',
      
      provider: 'provider',
      providers: 'Instructors',
      providerLowercase: 'provider',
      providersLowercase: 'instructors',
      
      businessType,
      paymentModel,
      isDriving: true,
      isMarketplace,
    }
  }
  
  // All other trades use generic terminology
  return {
    customer: 'Customer',
    customers: 'Customers',
    customerLowercase: 'customer',
    customersLowercase: 'customers',
    
    service: 'Booking',
    services: 'Bookings',
    serviceLowercase: 'booking',
    servicesLowercase: 'bookings',
    
    provider: 'Provider',
    providers: 'Providers',
    providerLowercase: 'provider',
    providersLowercase: 'providers',
    
    businessType,
    paymentModel,
    isDriving: false,
    isMarketplace,
  }
}
