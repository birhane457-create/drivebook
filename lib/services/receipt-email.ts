/**
 * Receipt Email Service
 * Sends formatted tax receipts for all payment events:
 *   A — Package purchase (Stripe, isPackageBooking=true)
 *   B — Wallet lesson booking (instructor books, wallet debit)
 *   C — Single lesson first-time (Stripe, single lesson)
 *   D — Wallet top-up (Stripe, wallet credit)
 */

import { emailService } from './email';

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';
const SUPPORT_EMAIL = process.env.ADMIN_EMAIL || 'support@drivebook.com.au';

function receiptNumber(id: string): string {
  const year = new Date().getFullYear();
  const short = id.slice(-6).toUpperCase();
  return `DB-${year}-${short}`;
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

function approxHours(balance: number, hourlyRate: number): string {
  if (!hourlyRate || hourlyRate <= 0) return '';
  const hrs = balance / hourlyRate;
  return ` (approx. ${hrs.toFixed(1)} hrs)`;
}

const styles = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
  .wrap { max-width: 600px; margin: 24px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #1d4ed8, #2563eb); color: white; padding: 28px 32px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.85; font-size: 14px; }
  .body { padding: 28px 32px; }
  .meta { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 14px; }
  .meta table { width: 100%; border-collapse: collapse; }
  .meta td { padding: 3px 0; }
  .meta td:first-child { color: #6b7280; width: 120px; }
  .meta td:last-child { font-weight: 600; }
  .section { margin-bottom: 20px; }
  .section h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 10px; }
  .line-items { width: 100%; border-collapse: collapse; font-size: 14px; }
  .line-items td { padding: 6px 0; }
  .line-items td:last-child { text-align: right; font-weight: 500; }
  .line-items .divider td { border-top: 1px solid #e5e7eb; padding-top: 10px; }
  .line-items .total td { font-size: 16px; font-weight: 700; color: #1d4ed8; }
  .wallet-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 14px; }
  .wallet-box table { width: 100%; border-collapse: collapse; }
  .wallet-box td { padding: 4px 0; }
  .wallet-box td:last-child { text-align: right; font-weight: 600; }
  .wallet-box .balance td { font-size: 16px; font-weight: 700; color: #1d4ed8; border-top: 1px solid #bfdbfe; padding-top: 10px; }
  .upsell { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #166534; }
  .policy { background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #92400e; }
  .policy ul { margin: 6px 0 0; padding-left: 18px; }
  .policy li { margin: 3px 0; }
  .stripe-ref { font-family: monospace; font-size: 11px; color: #9ca3af; }
  .footer { border-top: 1px solid #e5e7eb; padding: 20px 32px; font-size: 12px; color: #9ca3af; text-align: center; }
  .footer a { color: #2563eb; text-decoration: none; }
`;

function cancellationPolicy(): string {
  return `
    <div class="policy">
      <strong>Cancellation Policy</strong>
      <ul>
        <li>48+ hours notice: full refund</li>
        <li>24-48 hours notice: 50% refund</li>
        <li>Under 24 hours: no refund</li>
      </ul>
    </div>`;
}

function footer(rn: string, bookingId?: string): string {
  const manageLink = bookingId
    ? `<a href="${BASE_URL}/manage-booking?id=${bookingId}">Manage booking</a> &middot; `
    : '';
  return `
    <p style="font-size:14px;color:#6b7280;margin:0;">
      ${manageLink}Questions? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> &middot;
      <a href="${BASE_URL}/client-dashboard">View your dashboard</a> &middot;
      <a href="${BASE_URL}/login">Login to DriveBook</a>
    </p>
    <p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">
      New to DriveBook? Your account was created automatically. Login at ${BASE_URL}/login using the email this receipt was sent to.
    </p>
  </div>
  <div class="footer">DriveBook &middot; ${BASE_URL} &middot; Receipt ${rn}</div>
  </div></body></html>`;
}

// ── A: Package Purchase (Stripe) ──────────────────────────────────────────────
export async function sendPackagePurchaseReceipt(data: {
  clientName: string;
  clientEmail: string;
  receiptId: string;
  paidAt: Date;
  instructorName: string;
  instructorLocation?: string;
  packageHours: number;
  hourlyRate: number;
  discountPercent: number;
  subtotal: number;
  discount: number;
  platformFee: number;
  total: number;
  firstLessonDate: Date;
  firstLessonDurationHours: number;
  pickupAddress?: string;
  walletLoaded: number;
  firstLessonDebit: number;
  walletBalance: number;
  stripeRef?: string;
  paymentMethod?: string;
  bookingId?: string;
}) {
  const rn = receiptNumber(data.receiptId);
  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>&#x1F697; DriveBook &mdash; Tax Receipt</h1>
      <p>Package Purchase Confirmation</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Date</td><td>${data.paidAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} at ${data.paidAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</td></tr>
          <tr><td>Paid by</td><td>${data.clientName}</td></tr>
          <tr><td>Email</td><td>${data.clientEmail}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>What You Purchased</h3>
        <p style="margin:0;font-size:15px;font-weight:600;">${data.packageHours}-Hour Driving Lesson Package</p>
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">with ${data.instructorName}${data.instructorLocation ? ` &middot; ${data.instructorLocation}` : ''}</p>
        <p style="margin:12px 0 4px;font-size:14px;"><strong>First lesson:</strong> ${data.firstLessonDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${data.firstLessonDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
        ${data.pickupAddress ? `<p style="margin:0;font-size:14px;color:#6b7280;">&#x1F4CD; ${data.pickupAddress}</p>` : ''}
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Duration: ${data.firstLessonDurationHours} hour${data.firstLessonDurationHours !== 1 ? 's' : ''}</p>
      </div>

      <div class="section">
        <h3>Payment Breakdown</h3>
        <table class="line-items">
          <tr><td>${data.packageHours} hrs &times; ${fmt(data.hourlyRate)}/hr</td><td>${fmt(data.subtotal)}</td></tr>
          ${data.discount > 0 ? `<tr><td>Package discount (${data.discountPercent}%)</td><td style="color:#16a34a;">-${fmt(data.discount)}</td></tr>` : ''}
          <tr><td>Platform fee (3.6%)</td><td>+${fmt(data.platformFee)}</td></tr>
          <tr class="divider"><td></td><td></td></tr>
          <tr class="total"><td>Total Charged</td><td>${fmt(data.total)}</td></tr>
        </table>
        ${data.paymentMethod ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">Payment method: ${data.paymentMethod}</p>` : ''}
        ${data.stripeRef ? `<p class="stripe-ref" style="margin:4px 0 0;">Ref: ${data.stripeRef}</p>` : ''}
      </div>

      <div class="wallet-box">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;margin:0 0 10px;">Your Wallet Balance</h3>
        <table>
          <tr><td>Credits loaded</td><td>+${fmt(data.walletLoaded)}</td></tr>
          <tr><td>First lesson debit</td><td>-${fmt(data.firstLessonDebit)}</td></tr>
          <tr class="balance"><td>Remaining balance</td><td>${fmt(data.walletBalance)}${approxHours(data.walletBalance, data.hourlyRate)}</td></tr>
        </table>
      </div>

      ${cancellationPolicy()}
      ${footer(rn, data.bookingId)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Receipt ${rn} &mdash; ${data.packageHours}-Hour Package &middot; ${fmt(data.total)}`,
    html,
  });
}

// ── B: Wallet Lesson Booking (instructor books, wallet debit) ─────────────────
export async function sendWalletLessonReceipt(data: {
  clientName: string;
  clientEmail: string;
  receiptId: string;
  bookedAt: Date;
  instructorName: string;
  lessonDate: Date;
  durationHours: number;
  hourlyRate: number;
  lessonCost: number;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  bookedBy?: 'instructor' | 'client';
  bookingId?: string;
}) {
  const rn = receiptNumber(data.receiptId);
  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>&#x1F697; DriveBook &mdash; Booking Receipt</h1>
      <p>Lesson Booked from Wallet</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Date</td><td>${data.bookedAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
          <tr><td>Paid by</td><td>${data.clientName}</td></tr>
          ${data.bookedBy === 'instructor' ? `<tr><td>Booked by</td><td>Your instructor (${data.instructorName})</td></tr>` : ''}
        </table>
      </div>

      <div class="section">
        <h3>Lesson Booked</h3>
        <p style="margin:0;font-size:15px;font-weight:600;">${data.lessonDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${data.lessonDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Duration: ${data.durationHours} hour${data.durationHours !== 1 ? 's' : ''} &middot; Instructor: ${data.instructorName}</p>
      </div>

      <div class="section">
        <h3>Payment</h3>
        <table class="line-items">
          <tr><td>${data.durationHours} hr${data.durationHours !== 1 ? 's' : ''} &times; ${fmt(data.hourlyRate)}/hr</td><td>${fmt(data.lessonCost)}</td></tr>
          <tr><td>Paid from wallet</td><td style="color:#16a34a;">-${fmt(data.lessonCost)}</td></tr>
          <tr class="divider"><td></td><td></td></tr>
          <tr class="total"><td>Charged to card</td><td>$0.00</td></tr>
        </table>
      </div>

      <div class="wallet-box">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;margin:0 0 10px;">Wallet Balance</h3>
        <table>
          <tr><td>Before booking</td><td>${fmt(data.walletBalanceBefore)}</td></tr>
          <tr><td>Lesson debit</td><td>-${fmt(data.lessonCost)}</td></tr>
          <tr class="balance"><td>After booking</td><td>${fmt(data.walletBalanceAfter)}${approxHours(data.walletBalanceAfter, data.hourlyRate)}</td></tr>
        </table>
      </div>

      ${cancellationPolicy()}
      ${footer(rn, data.bookingId)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Receipt ${rn} &mdash; Lesson Booked &middot; ${data.lessonDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`,
    html,
  });
}

// ── C: Single Lesson (Stripe payment) ────────────────────────────────────────
export async function sendSingleLessonReceipt(data: {
  clientName: string;
  clientEmail: string;
  receiptId: string;
  paidAt: Date;
  instructorName: string;
  lessonDate: Date;
  durationHours: number;
  hourlyRate: number;
  lessonCost: number;
  platformFee: number;
  total: number;
  pickupAddress?: string;
  stripeRef?: string;
  paymentMethod?: string;
  bookingId?: string;
}) {
  const rn = receiptNumber(data.receiptId);
  const packageSaving = (data.hourlyRate * 10 * 0.10).toFixed(0);
  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>&#x1F697; DriveBook &mdash; Tax Receipt</h1>
      <p>Single Lesson Confirmation</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Date</td><td>${data.paidAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} at ${data.paidAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</td></tr>
          <tr><td>Paid by</td><td>${data.clientName}</td></tr>
          <tr><td>Email</td><td>${data.clientEmail}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>Lesson Details</h3>
        <p style="margin:0;font-size:15px;font-weight:600;">${data.lessonDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${data.lessonDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Duration: ${data.durationHours} hour${data.durationHours !== 1 ? 's' : ''} &middot; Instructor: ${data.instructorName}</p>
        ${data.pickupAddress ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">&#x1F4CD; ${data.pickupAddress}</p>` : ''}
      </div>

      <div class="section">
        <h3>Payment Breakdown</h3>
        <table class="line-items">
          <tr><td>${data.durationHours} hr${data.durationHours !== 1 ? 's' : ''} &times; ${fmt(data.hourlyRate)}/hr</td><td>${fmt(data.lessonCost)}</td></tr>
          <tr><td>Platform fee (3.6%)</td><td>+${fmt(data.platformFee)}</td></tr>
          <tr class="divider"><td></td><td></td></tr>
          <tr class="total"><td>Total Charged</td><td>${fmt(data.total)}</td></tr>
        </table>
        ${data.paymentMethod ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">Payment method: ${data.paymentMethod}</p>` : ''}
        ${data.stripeRef ? `<p class="stripe-ref" style="margin:4px 0 0;">Ref: ${data.stripeRef}</p>` : ''}
      </div>

      <div class="upsell">
        &#x1F4A1; <strong>Save with a package:</strong> Buy 10 hours and save $${packageSaving} &mdash; only ${fmt(data.hourlyRate * 10 * 0.9)}.
        <a href="${BASE_URL}/book" style="color:#166534;font-weight:600;"> Book a package &rarr;</a>
      </div>

      ${cancellationPolicy()}
      ${footer(rn, data.bookingId)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Receipt ${rn} &mdash; Driving Lesson &middot; ${fmt(data.total)}`,
    html,
  });
}

// ── D: Wallet Top-Up (Stripe) ─────────────────────────────────────────────────
export async function sendWalletTopUpReceipt(data: {
  clientName: string;
  clientEmail: string;
  receiptId: string;
  paidAt: Date;
  amountAdded: number;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  hourlyRate?: number;
  stripeRef?: string;
  paymentMethod?: string;
}) {
  const rn = receiptNumber(data.receiptId);
  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>&#x1F697; DriveBook &mdash; Wallet Receipt</h1>
      <p>Credits Added to Your Account</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Date</td><td>${data.paidAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} at ${data.paidAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</td></tr>
          <tr><td>Account</td><td>${data.clientName}</td></tr>
          <tr><td>Email</td><td>${data.clientEmail}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>Wallet Top-Up</h3>
        <table class="line-items">
          <tr><td>Credits added</td><td style="color:#16a34a;font-size:18px;font-weight:700;">+${fmt(data.amountAdded)}</td></tr>
        </table>
        ${data.paymentMethod ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">Payment method: ${data.paymentMethod}</p>` : ''}
        ${data.stripeRef ? `<p class="stripe-ref" style="margin:4px 0 0;">Ref: ${data.stripeRef}</p>` : ''}
      </div>

      <div class="wallet-box">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;margin:0 0 10px;">Wallet Balance</h3>
        <table>
          <tr><td>Previous balance</td><td>${fmt(data.walletBalanceBefore)}</td></tr>
          <tr><td>Top-up</td><td style="color:#16a34a;">+${fmt(data.amountAdded)}</td></tr>
          <tr class="balance"><td>New balance</td><td>${fmt(data.walletBalanceAfter)}${data.hourlyRate ? approxHours(data.walletBalanceAfter, data.hourlyRate) : ''}</td></tr>
        </table>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Credits never expire and can be used with any instructor on DriveBook.</p>
      ${footer(rn)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Receipt ${rn} &mdash; Wallet Top-Up &middot; +${fmt(data.amountAdded)}`,
    html,
  });
}

// ── E: Cancellation Refund ────────────────────────────────────────────────────
export async function sendCancellationReceipt(data: {
  clientName: string;
  clientEmail: string;
  receiptId: string;
  cancelledAt: Date;
  instructorName: string;
  lessonDate: Date;
  lessonPrice: number;
  refundAmount: number;
  refundPercent: number;
  walletBalanceAfter: number;
  cancelledBy: 'instructor' | 'client' | 'admin';
  noRefundReason?: string;
}) {
  const rn = receiptNumber(data.receiptId);
  const hasRefund = data.refundAmount > 0;
  const refundLine = hasRefund
    ? `<tr><td>Refund (${data.refundPercent}%)</td><td style="color:#16a34a;">+${fmt(data.refundAmount)}</td></tr>`
    : `<tr><td>Refund</td><td style="color:#dc2626;">None — ${data.noRefundReason || 'less than 24 hours notice'}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header" style="background:linear-gradient(135deg,#dc2626,#b91c1c);">
      <h1>&#x1F697; DriveBook &mdash; Booking Cancelled</h1>
      <p>Cancellation Confirmation</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Cancelled</td><td>${data.cancelledAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} at ${data.cancelledAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</td></tr>
          <tr><td>Cancelled by</td><td>${data.cancelledBy === 'instructor' ? 'Your instructor' : data.cancelledBy === 'admin' ? 'DriveBook support' : 'You'}</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>Cancelled Lesson</h3>
        <p style="margin:0;font-size:15px;font-weight:600;">${data.lessonDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at ${data.lessonDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Instructor: ${data.instructorName}</p>
      </div>

      <div class="section">
        <h3>Refund Summary</h3>
        <table class="line-items">
          <tr><td>Lesson price</td><td>${fmt(data.lessonPrice)}</td></tr>
          ${refundLine}
          <tr class="divider"><td></td><td></td></tr>
          <tr class="total"><td>${hasRefund ? 'Refunded to wallet' : 'Amount forfeited'}</td><td>${hasRefund ? fmt(data.refundAmount) : fmt(data.lessonPrice)}</td></tr>
        </table>
      </div>

      ${hasRefund ? `
      <div class="wallet-box">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;margin:0 0 10px;">Wallet Balance</h3>
        <table>
          <tr><td>Refund credited</td><td style="color:#16a34a;">+${fmt(data.refundAmount)}</td></tr>
          <tr class="balance"><td>Current balance</td><td>${fmt(data.walletBalanceAfter)}</td></tr>
        </table>
      </div>` : ''}

      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">
        Questions about this cancellation? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
      </p>
      ${footer(rn)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Booking Cancelled &mdash; ${data.lessonDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}${hasRefund ? ` &middot; ${fmt(data.refundAmount)} refunded` : ''}`,
    html,
  });
}

// ── F: Admin Manual Credit ────────────────────────────────────────────────────
export async function sendAdminCreditReceipt(data: {
  clientName: string;
  clientEmail: string;
  receiptId: string;
  creditedAt: Date;
  amountAdded: number;
  reason: string;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
}) {
  const rn = receiptNumber(data.receiptId);
  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>&#x1F697; DriveBook &mdash; Wallet Credit</h1>
      <p>Credits Added to Your Account</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Date</td><td>${data.creditedAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
          <tr><td>Account</td><td>${data.clientName}</td></tr>
          <tr><td>Issued by</td><td>DriveBook Support</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>Credit Details</h3>
        <table class="line-items">
          <tr><td>Credits added</td><td style="color:#16a34a;font-size:18px;font-weight:700;">+${fmt(data.amountAdded)}</td></tr>
          <tr><td>Reason</td><td>${data.reason}</td></tr>
        </table>
      </div>

      <div class="wallet-box">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;margin:0 0 10px;">Wallet Balance</h3>
        <table>
          <tr><td>Previous balance</td><td>${fmt(data.walletBalanceBefore)}</td></tr>
          <tr><td>Credit added</td><td style="color:#16a34a;">+${fmt(data.amountAdded)}</td></tr>
          <tr class="balance"><td>New balance</td><td>${fmt(data.walletBalanceAfter)}</td></tr>
        </table>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Credits never expire and can be used with any instructor on DriveBook.</p>
      ${footer(rn)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Wallet Credit &mdash; +${fmt(data.amountAdded)} added to your account`,
    html,
  });
}

// ── G: Admin Manual Deduction ─────────────────────────────────────────────────
export async function sendAdminDeductionReceipt(data: {
  clientName: string;
  clientEmail: string;
  transactionId: string;  // WalletTransaction.id — the DB record, unique, traceable
  deductedAt: Date;
  amountDeducted: number;
  reason: string;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
}) {
  const rn = receiptNumber(data.transactionId);
  const html = `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
  <div class="wrap">
    <div class="header" style="background:linear-gradient(135deg,#dc2626,#b91c1c);">
      <h1>&#x1F697; DriveBook &mdash; Wallet Adjustment</h1>
      <p>Credit Deducted from Your Account</p>
    </div>
    <div class="body">
      <div class="meta">
        <table>
          <tr><td>Receipt #</td><td>${rn}</td></tr>
          <tr><td>Transaction ID</td><td style="font-family:monospace;font-size:12px;">${data.transactionId}</td></tr>
          <tr><td>Date</td><td>${data.deductedAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} at ${data.deductedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</td></tr>
          <tr><td>Account</td><td>${data.clientName}</td></tr>
          <tr><td>Issued by</td><td>DriveBook Support</td></tr>
        </table>
      </div>

      <div class="section">
        <h3>Deduction Details</h3>
        <table class="line-items">
          <tr><td>Amount deducted</td><td style="color:#dc2626;font-size:18px;font-weight:700;">-${fmt(data.amountDeducted)}</td></tr>
          <tr><td>Reason</td><td>${data.reason}</td></tr>
        </table>
      </div>

      <div class="wallet-box">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1d4ed8;margin:0 0 10px;">Wallet Balance</h3>
        <table>
          <tr><td>Previous balance</td><td>${fmt(data.walletBalanceBefore)}</td></tr>
          <tr><td>Deduction</td><td style="color:#dc2626;">-${fmt(data.amountDeducted)}</td></tr>
          <tr class="balance"><td>New balance</td><td>${fmt(data.walletBalanceAfter)}</td></tr>
        </table>
      </div>

      <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">
        If you believe this deduction was made in error, please contact us at
        <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> and quote Transaction ID <strong>${data.transactionId}</strong>.
      </p>
      ${footer(rn)}`;

  await emailService.sendGenericEmail({
    to: data.clientEmail,
    subject: `Wallet Adjustment &mdash; -${fmt(data.amountDeducted)} deducted from your account`,
    html,
  });
}
