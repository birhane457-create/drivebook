import { Badge } from './badge'

/**
 * TransactionStatusBadge
 * Renders a themed badge for transaction / booking statuses.
 * Replaces all hardcoded light-mode bg-green-100/amber-100/gray-100 spans
 * that were broken in dark mode across wallet, bookings, and admin pages.
 */

const STATUS_MAP: Record<string, {
  variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' | 'default'
  label: string
}> = {
  // Transaction statuses
  CONFIRMED:  { variant: 'success',     label: 'Confirmed' },
  COMPLETED:  { variant: 'success',     label: 'Completed' },
  SETTLED:    { variant: 'success',     label: 'Settled' },
  PAID:       { variant: 'success',     label: 'Paid' },
  PENDING:    { variant: 'warning',     label: 'Pending' },
  PROCESSING: { variant: 'warning',     label: 'Processing' },
  AWAITING:   { variant: 'warning',     label: 'Awaiting' },
  SENT:       { variant: 'info',        label: 'Sent' },
  FAILED:     { variant: 'destructive', label: 'Failed' },
  CANCELLED:  { variant: 'destructive', label: 'Cancelled' },
  CANCELED:   { variant: 'destructive', label: 'Cancelled' },
  REFUNDED:   { variant: 'secondary',   label: 'Refunded' },
  WITHHELD:   { variant: 'warning',     label: 'Withheld' },
  DISPUTED:   { variant: 'destructive', label: 'Disputed' },
  // Wallet statuses
  CREDIT:     { variant: 'success',     label: 'Credit' },
  DEBIT:      { variant: 'secondary',   label: 'Debit' },
  // Booking statuses
  CONFIRMED_BOOKING: { variant: 'success', label: 'Confirmed' },
  NO_SHOW:    { variant: 'destructive', label: 'No Show' },
  REQUESTED:  { variant: 'info',        label: 'Requested' },
}

interface TransactionStatusBadgeProps {
  status: string
  className?: string
  /** Override display label */
  label?: string
}

export function TransactionStatusBadge({ status, className, label }: TransactionStatusBadgeProps) {
  const key   = status?.toUpperCase().replace(/[\s-]/g, '_') ?? ''
  const config = STATUS_MAP[key] ?? { variant: 'secondary' as const, label: status }
  return (
    <Badge variant={config.variant} className={className}>
      {label ?? config.label}
    </Badge>
  )
}
