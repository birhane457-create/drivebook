/**
 * Chargeback Automation Service
 *
 * Handles Stripe dispute lifecycle:
 *  handleDisputeOpened   — freezes instructor payout, creates Task, records ledger entry
 *  handleDisputeClosed   — resolves on win/loss, releases hold or writes ADJUSTMENT
 *  processChargebackDefense — placeholder for evidence submission (future)
 *
 * Called by the Stripe webhook handler (charge.dispute.created/updated/closed).
 */

import { prisma } from '@/lib/prisma';
import { appendLedgerEntry, incrementLedger } from '@/lib/services/ledger-service';
import { sendAlert } from '@/lib/services/alert-service';
import { createPaymentDisputeTask } from '@/lib/services/taskManager';

// Cast prisma to any for models added after the last `prisma generate`
// (StripeDispute was added in migration 20260604 — regenerate client after deploying migration)
const db = prisma as any;

export interface ChargebackEvent {
  disputeId: string;       // dp_xxx
  chargeId: string;        // ch_xxx
  paymentIntentId?: string; // pi_xxx
  amount: number;          // in AUD (already divided by 100)
  currency: string;
  reason: string;
  status: string;
}

// ─── Open / Updated ──────────────────────────────────────────────────────────

export async function handleChargebackEvent(event: ChargebackEvent): Promise<void> {
  const { disputeId, chargeId, paymentIntentId, amount, currency, reason, status } = event;

  // Resolve booking + instructor from payment intent metadata
  let bookingId: string | null = null;
  let instructorId: string | null = null;

  if (paymentIntentId) {
    const booking = await prisma.booking.findFirst({
      where: { paymentIntentId },
      select: { id: true, instructorId: true },
    });
    if (booking) {
      bookingId = booking.id;
      instructorId = booking.instructorId;
    }
  }

  // Upsert the StripeDispute record
  const dispute = await db.stripeDispute.upsert({
    where: { stripeDisputeId: disputeId },
    create: {
      stripeDisputeId: disputeId,
      stripeChargeId: chargeId,
      stripePaymentIntentId: paymentIntentId,
      bookingId,
      instructorId,
      amount,
      currency,
      reason,
      status,
    },
    update: {
      status,
      bookingId: bookingId ?? undefined,
      instructorId: instructorId ?? undefined,
    },
  });

  // Freeze payout if not already frozen
  if (instructorId && !dispute.payoutFrozen) {
    await db.instructor.update({
      where: { id: instructorId },
      data: {
        payoutHold: true,
        payoutHoldReason: `Stripe dispute ${disputeId} — ${reason}`,
      },
    });

    await db.stripeDispute.update({
      where: { stripeDisputeId: disputeId },
      data: { payoutFrozen: true },
    });
  }

  // Ledger: record amount at risk
  await appendLedgerEntry({
    type: 'DISPUTE_OPENED',
    amount,
    referenceId: disputeId,
    referenceType: 'TRANSACTION',
    instructorId: instructorId ?? undefined,
    description: `Stripe dispute opened — ${reason} — charge ${chargeId}`,
    metadata: { disputeId, chargeId, paymentIntentId, bookingId, reason, status },
  });

  await incrementLedger({ totalReserved: amount });

  // Create staff task for financial team to action
  if (bookingId) {
    await createPaymentDisputeTask({
      clientId: '', // unknown at this point — task created for tracking
      bookingId,
      amount,
      reason,
      contactName: 'Unknown — check booking',
      contactEmail: '',
    }).catch((err) => console.error('Failed to create dispute task (non-fatal):', err));
  }

  // Alert admin
  await sendAlert({
    type: 'DISPUTE_OPENED',
    severity: 'HIGH',
    message: `Stripe dispute ${disputeId} opened — $${amount} — reason: ${reason}`,
    metadata: { disputeId, chargeId, paymentIntentId, bookingId, instructorId, amount, reason, status },
  });

  console.log(`✅ Dispute opened handled: ${disputeId} — instructor ${instructorId ?? 'unknown'} payout frozen`);
}

// ─── Closed (won or lost) ────────────────────────────────────────────────────

export async function handleChargebackResolution(
  disputeId: string,
  outcome: 'won' | 'lost' | 'charge_refunded' | string
): Promise<void> {
  const dispute = await db.stripeDispute.findUnique({
    where: { stripeDisputeId: disputeId },
  });

  if (!dispute) {
    console.warn(`⚠️ Dispute ${disputeId} not found in DB — skipping resolution`);
    return;
  }

  const won = outcome === 'won';

  // Update dispute record
  await db.stripeDispute.update({
    where: { stripeDisputeId: disputeId },
    data: {
      status: outcome,
      resolvedAt: new Date(),
    },
  });

  if (won) {
    // ── We won: reverse the hold, release payout freeze ──────────────────────
    if (dispute.instructorId) {
      await db.instructor.update({
        where: { id: dispute.instructorId },
        data: { payoutHold: false, payoutHoldReason: null },
      });
    }

    await appendLedgerEntry({
      type: 'DISPUTE_WON',
      amount: dispute.amount,
      referenceId: disputeId,
      referenceType: 'TRANSACTION',
      instructorId: dispute.instructorId ?? undefined,
      description: `Dispute ${disputeId} WON — payout hold released`,
      metadata: { disputeId, outcome, bookingId: dispute.bookingId },
    });

    await incrementLedger({ totalReserved: -dispute.amount }); // release the reservation

    await sendAlert({
      type: 'DISPUTE_WON',
      severity: 'LOW',
      message: `Dispute ${disputeId} WON — $${dispute.amount} retained`,
      metadata: { disputeId, instructorId: dispute.instructorId, amount: dispute.amount },
    });

    console.log(`✅ Dispute ${disputeId} WON — payout hold released for instructor ${dispute.instructorId}`);
  } else {
    // ── We lost: write ADJUSTMENT to claw back instructor payout if needed ───
    if (!dispute.adjustmentCreated) {
      await appendLedgerEntry({
        type: 'DISPUTE_LOST',
        amount: dispute.amount,
        referenceId: disputeId,
        referenceType: 'TRANSACTION',
        instructorId: dispute.instructorId ?? undefined,
        description: `Dispute ${disputeId} LOST — platform absorbs $${dispute.amount}`,
        metadata: {
          disputeId,
          outcome,
          bookingId: dispute.bookingId,
          stripeFee: 25, // Stripe charges ~$25 AUD dispute fee
        },
      });

      // Deduct from platform collected (we lose both the booking amount + stripe fee)
      await incrementLedger({
        totalCollected: -(dispute.amount),
        totalReserved: -dispute.amount,
      });

      await db.stripeDispute.update({
        where: { stripeDisputeId: disputeId },
        data: { adjustmentCreated: true },
      });

      // Keep payout hold on instructor until admin reviews
      // (admin can manually clear via admin panel)
    }

    await sendAlert({
      type: 'DISPUTE_LOST',
      severity: 'CRITICAL',
      message: `Dispute ${disputeId} LOST — platform absorbs $${dispute.amount}. Admin review required.`,
      metadata: { disputeId, instructorId: dispute.instructorId, amount: dispute.amount, bookingId: dispute.bookingId },
    });

    console.log(`🚨 Dispute ${disputeId} LOST — $${dispute.amount} adjustment recorded`);
  }
}

// ─── Evidence submission ─────────────────────────────────────────────────────

/**
 * Submits dispute evidence to Stripe and alerts the admin.
 *
 * Evidence gathered automatically from the booking record:
 *   - Service date (startTime)
 *   - Customer name and contact
 *   - Booking confirmation reference
 *   - Instructor name
 *
 * Admin should supplement with lesson notes and any communication screenshots
 * via the Stripe Dashboard before the deadline.
 */
export async function processChargebackDefense(disputeId: string): Promise<void> {
  const dispute = await db.stripeDispute.findUnique({
    where: { stripeDisputeId: disputeId },
  })

  if (!dispute) {
    console.warn(`[chargeback] processChargebackDefense: dispute ${disputeId} not found in DB`)
    return
  }

  // Gather evidence from booking
  let evidenceText = `DriveBook dispute response for ${disputeId}.\n`

  if (dispute.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: dispute.bookingId },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        instructor: { select: { name: true, phone: true } },
      },
    }).catch(() => null)

    if (booking) {
      const serviceDate = booking.startTime
        ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'Date not recorded'

      evidenceText += `\nService Details:\n`
      evidenceText += `- Service date: ${serviceDate}\n`
      evidenceText += `- Student: ${booking.client?.name ?? 'Unknown'}\n`
      evidenceText += `- Student email: ${booking.client?.email ?? 'Unknown'}\n`
      evidenceText += `- Instructor: ${booking.instructor?.name ?? 'Unknown'}\n`
      evidenceText += `- Booking ID: ${booking.id}\n`
      evidenceText += `- Amount charged: $${booking.price.toFixed(2)} AUD\n`
      evidenceText += `- Payment confirmed: ${booking.isPaid ? 'Yes' : 'No'}\n`
      evidenceText += `\nThe customer agreed to DriveBook's terms of service at registration. `
      evidenceText += `The lesson was scheduled and confirmed by both parties. `
      evidenceText += `Please see Stripe Dashboard for any additional documentation.`
    }
  }

  // Submit to Stripe
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20' as any,
    })

    await stripe.disputes.update(disputeId, {
      evidence: {
        product_description: 'Driving lesson booking via DriveBook platform',
        service_documentation: evidenceText,
        uncategorized_text: evidenceText,
      },
      submit: false, // Don't auto-submit — admin reviews first in Stripe Dashboard
    })

    console.log(`[chargeback] Evidence staged for ${disputeId} — admin must review and submit in Stripe Dashboard`)

    await sendAlert({
      type: 'DISPUTE_EVIDENCE_STAGED',
      severity: 'HIGH',
      message: `Dispute ${disputeId}: Evidence staged in Stripe Dashboard. Review and submit before the deadline.`,
      metadata: { disputeId, action: 'evidence_staged', bookingId: dispute.bookingId },
    })
  } catch (stripeErr) {
    console.error(`[chargeback] Failed to stage evidence for ${disputeId}:`, stripeErr)

    // Fall back to manual alert if Stripe call fails
    await sendAlert({
      type: 'DISPUTE_EVIDENCE_NEEDED',
      severity: 'CRITICAL',
      message: `Dispute ${disputeId} requires MANUAL evidence submission — automated staging failed. Log in to Stripe Dashboard immediately.`,
      metadata: { disputeId, action: 'manual_evidence_required', error: String(stripeErr) },
    })
  }
}
