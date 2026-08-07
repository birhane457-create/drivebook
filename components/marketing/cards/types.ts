// components/marketing/cards/types.ts

export type Transmission = 'AUTOMATIC' | 'MANUAL' | 'BOTH'

export interface CardData {
  instructorName: string
  phone: string
  suburbs: string          // editable — "Perth • Maylands • Morley"
  transmission: Transmission
  bookingUrl: string
  showDriveBookFooter: boolean
  /** e.g. "Toyota Corolla" — pre-filled from carMake + carModel, editable */
  carLabel?: string
  /** Display domain shown in the footer — derived from bookingUrl */
  footerDomain?: string
}

export type CardOrderStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PRINTING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

export interface CardOrder {
  id: string
  instructorId: string
  instructorName: string
  quantity: number
  status: CardOrderStatus
  notes?: string
  createdAt: string
  updatedAt: string
}
