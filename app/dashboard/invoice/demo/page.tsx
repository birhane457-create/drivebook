'use client';

/**
 * /dashboard/invoice/demo
 * ─────────────────────────────────────────────
 * Preview-only page with hardcoded demo data.
 * Lets you see the exact invoice/receipt layout
 * before any real transactions exist.
 *
 * Visit: http://localhost:3000/dashboard/invoice/demo
 * Print: Cmd/Ctrl + P → "Save as PDF" for a proper PDF.
 */

import InvoiceLayout from '@/components/invoice/InvoiceLayout';

const DEMO_DATA = {
  invoiceNumber: 'INV-2026-00042',
  issueDate: '22 Jul 2026',
  dueDate: 'Paid',
  status: 'PAID' as const,

  instructor: {
    name: 'James Nguyen',
    businessName: 'Nguyen Drive Training',
    email: 'james@nguyendrive.com.au',
    phone: '0412 345 678',
    abn: null, // null = not set — shows placeholder
    brandColor: '#6366f1', // indigo
    logoUrl: null,
  },

  platform: {
    name: 'DriveBook',
    email: 'support@drivebook.com.au',
    website: 'drivebook.com.au',
    abn: '12 345 678 901',
  },

  client: {
    name: 'Sophie Anderson',
    email: 'sophie.anderson@email.com',
    phone: '0432 100 200',
  },

  lesson: {
    date: 'Tuesday, 22 July 2026',
    startTime: '09:00 AM',
    endTime: '11:00 AM',
    durationHours: 2,
    type: 'Standard Lesson',
    pickupAddress: '14 Stirling Hwy, Claremont WA 6010',
    bookingRef: 'BK-2026-08871',
    isPackage: false,
  },

  payment: {
    grossAmount: 180.00,
    platformFee: 21.60,
    commissionRate: 12,
    instructorPayout: 158.40,
    paymentMethod: 'Visa •••• 4242',
    stripePaymentId: 'pi_3PxDemo00000000001',
    paidAt: '22 Jul 2026, 9:02 AM AWST',
  },
};

export default function InvoiceDemoPage() {
  return <InvoiceLayout data={DEMO_DATA} isDemo />;
}
