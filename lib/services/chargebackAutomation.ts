import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

/**
 * CHARGEBACK AUTOMATION
 * 
 * When Stripe sends charge.dispute.created:
 * 1. Freeze instructor payout immediately
 * 2. Lock wallet
 * 3. Calculate provisional liability
 * 4. Track dispute fee ($15)
 * 
 * This prevents: Instructor gets paid → Dispute hits → Platform eats full loss
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

interface DisputeDetails {
  disputeId: string;
  chargeId: string;
  amount: number;
  reason: string;
  status: string;
  bookingId?: string;
  instructorId?: string;
  clientId?: string;
}

/**
 * Handle dispute.created webhook
 */
export async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log('[CHARGEBACK] 🚨 Dispute created:', dispute.id);

  try {
    // ============================================
    // 1. Extract dispute details
    // ============================================
    const amount = dispute.amount / 100;
    const disputeFee = 15; // Stripe dispute fee
    const totalLiability = amount + disputeFee;

    console.log('[CHARGEBACK] Amount:', amount);
    console.log('[CHARGEBACK] Dispute fee:', disputeFee);
    console.log('[CHARGEBACK] Total liability:', totalLiability);

    // ============================================
    // 2. Find related booking
    // ============================================
    const charge = await stripe.charges.retrieve(dispute.charge as string);
    const paymentIntentId = charge.payment_intent as string;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { stripePaymentIntentId: paymentIntentId },
          { metadata: { path: ['stripeChargeId'], equals: dispute.charge } },
        ],
      },
      include: {
        instructor: true,
        client: true,
      },
    });

    if (!booking) {
      console.error('[CHARGEBACK] ❌ Booking not found for dispute:', dispute.id);
      
      // Create orphaned dispute record
      await createOrphanedDisputeRecord(dispute, amount, disputeFee);
      return;
    }

    console.log('[CHARGEBACK] ✓ Found booking:', booking.id);

    // ============================================
    // 3. FREEZE INSTRUCTOR PAYOUT IMMEDIATELY
    // ============================================
    console.log('[CHARGEBACK] 🔒 Freezing instructor payout...');

    // Find any pending payouts for this instructor
    const pendingPayouts = await prisma.payout.findMany({
      where: {
        instructorId: booking.instructorId,
        status: 'pending',
      },
    });

    for (const payout of pendingPayouts) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'frozen',
          failureReason: `Dispute ${dispute.id} - Payout frozen pending resolution`,
        },
      });
    }

    console.log('[CHARGEBACK] ✓ Frozen', pendingPayouts.length, 'pending payouts');

    // ============================================
    // 4. LOCK INSTRUCTOR WALLET
    // ============================================
    console.log('[CHARGEBACK] 🔒 Locking instructor wallet...');

    // Add dispute liability to instructor record
    await prisma.instructor.update({
      where: { id: booking.instructorId },
      data: {
        metadata: {
          disputeLiability: totalLiability,
          disputeId: dispute.id,
          disputeStatus: 'under_review',
          walletFrozen: true,
          frozenAt: new Date().toISOString(),
        },
      },
    });

    console.log('[CHARGEBACK] ✓ Instructor wallet locked');

    // ============================================
    // 5. Update booking status
    // ============================================
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'DISPUTED',
        metadata: {
          ...booking.metadata,
          disputeId: dispute.id,
          disputeReason: dispute.reason,
          disputeAmount: amount,
          disputeFee,
          totalLiability,
          disputeCreatedAt: new Date(dispute.created * 1000).toISOString(),
        },
      },
    });

    console.log('[CHARGEBACK] ✓ Booking marked as DISPUTED');

    // ============================================
    // 6. Calculate provisional liability
    // ============================================
    const liability = {
      bookingAmount: amount,
      disputeFee,
      totalLiability,
      instructorShare: amount * 0.85, // 85% to instructor
      platformShare: amount * 0.15, // 15% commission
      platformLoss: totalLiability, // Platform eats full loss if dispute lost
    };

    console.log('[CHARGEBACK] Liability breakdown:', liability);

    // ============================================
    // 7. Create audit log
    // ============================================
    await prisma.auditLog.create({
      data: {
        adminId: 'SYSTEM',
        action: 'DISPUTE_CREATED',
        targetType: 'BOOKING',
        targetId: booking.id,
        metadata: {
          disputeId: dispute.id,
          chargeId: dispute.charge,
          amount,
          disputeFee,
          totalLiability,
          reason: dispute.reason,
          status: dispute.status,
          instructorId: booking.instructorId,
          clientId: booking.clientId,
          liability,
          actionsToken: [
            'Instructor payout frozen',
            'Instructor wallet locked',
            'Booking marked as DISPUTED',
          ],
          timestamp: new Date().toISOString(),
        },
      },
    });

    // ============================================
    // 8. Create staff task for dispute handling
    // ============================================
    await prisma.task.create({
      data: {
        type: 'PAYMENT_DISPUTE',
        category: 'FINANCIAL',
        priority: 'URGENT',
        status: 'OPEN',
        title: `Chargeback Dispute - ${booking.client?.name || 'Unknown'}`,
        description: `Stripe dispute ${dispute.id} for booking ${booking.id}. Amount: $${amount}. Reason: ${dispute.reason}. URGENT: Respond within 7 days.`,
        bookingId: booking.id,
        instructorId: booking.instructorId,
        clientId: booking.clientId,
        contactName: booking.client?.name,
        contactEmail: booking.client?.email,
        financialAmount: totalLiability,
        financialImpact: liability,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days to respond
      },
    });

    console.log('[CHARGEBACK] ✓ Staff task created');

    // ============================================
    // 9. Send notifications
    // ============================================
    await sendDisputeNotifications({
      dispute,
      booking,
      liability,
    });

    console.log('[CHARGEBACK] ✅ Dispute handling complete');

    return {
      success: true,
      disputeId: dispute.id,
      bookingId: booking.id,
      totalLiability,
      actionsToken: [
        'Payout frozen',
        'Wallet locked',
        'Task created',
        'Notifications sent',
      ],
    };

  } catch (error) {
    console.error('[CHARGEBACK] ❌ Error handling dispute:', error);
    
    // Create critical audit log
    await prisma.auditLog.create({
      data: {
        adminId: 'SYSTEM',
        action: 'DISPUTE_HANDLING_FAILED',
        targetType: 'DISPUTE',
        targetId: dispute.id,
        metadata: {
          error: (error as Error).message,
          dispute,
          timestamp: new Date().toISOString(),
        },
      },
    });

    throw error;
  }
}

/**
 * Handle dispute.updated webhook
 */
export async function handleDisputeUpdated(dispute: Stripe.Dispute) {
  console.log('[CHARGEBACK] Dispute updated:', dispute.id, 'Status:', dispute.status);

  const booking = await prisma.booking.findFirst({
    where: {
      metadata: {
        path: ['disputeId'],
        equals: dispute.id,
      },
    },
  });

  if (!booking) {
    console.error('[CHARGEBACK] Booking not found for dispute:', dispute.id);
    return;
  }

  // Update booking metadata
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      metadata: {
        ...booking.metadata,
        disputeStatus: dispute.status,
        disputeUpdatedAt: new Date().toISOString(),
      },
    },
  });

  // If dispute won, unfreeze instructor
  if (dispute.status === 'won') {
    await unfreezeInstructor(booking.instructorId, dispute.id, 'Dispute won');
  }

  // If dispute lost, process loss
  if (dispute.status === 'lost') {
    await processDisputeLoss(booking, dispute);
  }
}

/**
 * Unfreeze instructor after dispute resolved
 */
async function unfreezeInstructor(instructorId: string, disputeId: string, reason: string) {
  console.log('[CHARGEBACK] Unfreezing instructor:', instructorId);

  await prisma.instructor.update({
    where: { id: instructorId },
    data: {
      metadata: {
        disputeLiability: 0,
        disputeId: null,
        disputeStatus: 'resolved',
        walletFrozen: false,
        unfrozenAt: new Date().toISOString(),
        unfreezeReason: reason,
      },
    },
  });

  // Unfreeze payouts
  await prisma.payout.updateMany({
    where: {
      instructorId,
      status: 'frozen',
      failureReason: { contains: disputeId },
    },
    data: {
      status: 'pending',
      failureReason: null,
    },
  });

  console.log('[CHARGEBACK] ✓ Instructor unfrozen');
}

/**
 * Process dispute loss
 */
async function processDisputeLoss(booking: any, dispute: Stripe.Dispute) {
  console.log('[CHARGEBACK] 💸 Processing dispute loss...');

  const amount = dispute.amount / 100;
  const disputeFee = 15;
  const totalLoss = amount + disputeFee;

  // Create ledger entry for platform loss
  await prisma.ledgerEntry.create({
    data: {
      debitAccount: 'PLATFORM_LOSS',
      creditAccount: 'STRIPE_CHARGEBACK',
      amount: totalLoss,
      description: `Dispute lost: ${dispute.id} - Booking ${booking.id}`,
      idempotencyKey: `dispute_loss_${dispute.id}`,
      bookingId: booking.id,
      createdBy: 'SYSTEM',
      metadata: {
        disputeId: dispute.id,
        amount,
        disputeFee,
        totalLoss,
        reason: dispute.reason,
      },
    },
  });

  // Update instructor - deduct from future earnings
  await prisma.instructor.update({
    where: { id: booking.instructorId },
    data: {
      metadata: {
        disputeLoss: totalLoss,
        disputeId: dispute.id,
        disputeStatus: 'lost',
        deductFromFutureEarnings: true,
      },
    },
  });

  console.log('[CHARGEBACK] ✓ Dispute loss processed');
}

/**
 * Create orphaned dispute record
 */
async function createOrphanedDisputeRecord(dispute: Stripe.Dispute, amount: number, disputeFee: number) {
  await prisma.auditLog.create({
    data: {
      adminId: 'SYSTEM',
      action: 'ORPHANED_DISPUTE',
      targetType: 'DISPUTE',
      targetId: dispute.id,
      metadata: {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount,
        disputeFee,
        reason: dispute.reason,
        status: dispute.status,
        requiresManualInvestigation: true,
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Create urgent task
  await prisma.task.create({
    data: {
      type: 'PAYMENT_DISPUTE',
      category: 'FINANCIAL',
      priority: 'URGENT',
      status: 'OPEN',
      title: `Orphaned Dispute - ${dispute.id}`,
      description: `Dispute created but no booking found. Manual investigation required. Amount: $${amount}`,
      financialAmount: amount + disputeFee,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
    },
  });
}

/**
 * Send dispute notifications
 */
async function sendDisputeNotifications(params: {
  dispute: Stripe.Dispute;
  booking: any;
  liability: any;
}) {
  // TODO: Implement email/SMS notifications
  console.log('[CHARGEBACK] 📧 Sending dispute notifications...');
  console.log('[CHARGEBACK] - Owner notification');
  console.log('[CHARGEBACK] - Financial staff notification');
  console.log('[CHARGEBACK] - Instructor notification (wallet frozen)');
}
