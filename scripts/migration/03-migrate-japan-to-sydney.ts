/**
 * Step 3: Migrate Japan → Sydney
 *
 * Reads from Japan (old schema) and writes to Sydney (new schema).
 * Handles renames: Instructor→Provider, Client→Customer, instructorId→providerId etc.
 *
 * SAFE TO RE-RUN: uses upsert where possible; skips existing records.
 *
 * Run order matters — dependencies must be created before dependents:
 *   Users → Instructors(→Providers) → Clients(→Customers) →
 *   Subscriptions → Bookings → Transactions → everything else
 *
 * Usage:
 *   JAPAN_URL=<japan> SYDNEY_URL=<sydney> npx ts-node scripts/migration/03-migrate-japan-to-sydney.ts
 */

import { PrismaClient } from '@prisma/client'

const JAPAN_URL  = process.env.JAPAN_URL
const SYDNEY_URL = process.env.SYDNEY_URL

if (!JAPAN_URL || !SYDNEY_URL) {
  console.error('Set JAPAN_URL and SYDNEY_URL environment variables')
  process.exit(1)
}

const japan  = new PrismaClient({ datasourceUrl: JAPAN_URL })
const sydney = new PrismaClient({ datasourceUrl: SYDNEY_URL })

// ── helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(msg) }
function step(msg: string) { console.log(`\n── ${msg} ──`) }

async function run() {
  log(`Japan  → ${JAPAN_URL!.match(/@([^:/?]+)/)?.[1]}`)
  log(`Sydney → ${SYDNEY_URL!.match(/@([^:/?]+)/)?.[1]}`)
  log(`Started: ${new Date().toISOString()}`)

  // ── 1. Users ─────────────────────────────────────────────────────────────
  step('1 / Users')
  const users: any[] = await japan.$queryRaw`SELECT * FROM "User"`
  let upserted = 0
  for (const u of users) {
    await sydney.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id:         u.id,
        email:      u.email,
        password:   u.password   ?? null,
        name:       u.name       ?? null,
        role:       u.role       ?? 'CLIENT',
        providerId: null,                             // set after providers migrated
        createdAt:  u.createdAt  ?? new Date(),
        updatedAt:  u.updatedAt  ?? new Date(),
      },
    })
    upserted++
  }
  log(`  Users: ${upserted} upserted`)

  // ── 2. Instructors → Providers ───────────────────────────────────────────
  step('2 / Instructors → Providers')
  const instructors: any[] = await japan.$queryRaw`SELECT * FROM "Instructor"`
  let provCount = 0
  for (const inst of instructors) {
    await sydney.provider.upsert({
      where: { id: inst.id },
      update: {},
      create: {
        id:                   inst.id,
        userId:               inst.userId               ?? null,
        name:                 inst.name,
        phone:                inst.phone,
        hourlyRate:           inst.hourlyRate           ?? 0,
        serviceAreas:         inst.serviceAreas         ?? null,
        bio:                  inst.bio                  ?? null,
        languages:            inst.languages            ?? null,
        baseAddress:          inst.baseAddress          ?? null,
        serviceRadiusKm:      inst.serviceRadiusKm      ?? null,
        isActive:             inst.isActive             ?? true,
        isVerified:           inst.isVerified           ?? false,
        isFeatured:           inst.isFeatured           ?? false,
        averageRating:        inst.averageRating        ?? null,
        totalReviews:         inst.totalReviews         ?? 0,
        subscriptionTier:     inst.subscriptionTier     ?? 'BASIC',
        subscriptionStatus:   inst.subscriptionStatus   ?? 'TRIAL',
        trialEndsAt:          inst.trialEndsAt          ?? null,
        accountType:          inst.accountType          ?? 'INDIVIDUAL',
        paymentMode:          inst.paymentMode          ?? 'PLATFORM',
        stripeCustomerId:     inst.stripeCustomerId     ?? null,
        stripeAccountId:      inst.stripeAccountId      ?? null,
        profileImage:         inst.profileImage         ?? null,
        documentsVerified:    inst.documentsVerified    ?? false,
        documentsVerifiedAt:  inst.documentsVerifiedAt  ?? null,
        approvalStatus:       inst.approvalStatus       ?? 'APPROVED',
        workingHours:         inst.workingHours         ?? null,
        abn:                  inst.abn                  ?? null,
        abnVerified:          inst.abnVerified          ?? false,
        gstRegistered:        inst.gstRegistered        ?? false,
        withholdingTaxRate:   inst.withholdingTaxRate   ?? 47,
        payoutMethod:         inst.payoutMethod         ?? 'stripe_connect',
        bankBsb:              inst.bankBsb              ?? null,
        bankAccount:          inst.bankAccount          ?? null,
        bankAccountName:      inst.bankAccountName      ?? null,
        chargesEnabled:       inst.chargesEnabled       ?? false,
        payoutsEnabled:       inst.payoutsEnabled       ?? false,
        acceptingBookings:    inst.acceptingBookings    ?? true,
        businessModel:        'MARKETPLACE',
      },
    })
    provCount++
  }
  log(`  Providers: ${provCount} upserted`)

  // Update User.providerId back-reference
  for (const inst of instructors) {
    if (inst.userId) {
      await sydney.user.update({
        where: { id: inst.userId },
        data: { providerId: inst.id },
      }).catch(() => {}) // skip if user not found
    }
  }
  log(`  User.providerId back-references updated`)

  // ── 3. Clients → Customers ──────────────────────────────────────────────
  step('3 / Clients → Customers')
  const clients: any[] = await japan.$queryRaw`SELECT * FROM "Client"`
  let custCount = 0
  for (const cl of clients) {
    // Map instructorId → preferredProviderId
    await sydney.customer.upsert({
      where: { id: cl.id },
      update: {},
      create: {
        id:                   cl.id,
        userId:               cl.userId               ?? null,
        name:                 cl.name,
        email:                cl.email,
        phone:                cl.phone,
        defaultPickupAddress: cl.defaultPickupAddress ?? null,
        defaultPickupLat:     cl.defaultPickupLat     ?? null,
        defaultPickupLng:     cl.defaultPickupLng     ?? null,
        notes:                cl.notes                ?? null,
        preferredProviderId:  cl.instructorId         ?? null,
      },
    })
    custCount++
  }
  log(`  Customers: ${custCount} upserted`)

  // ── 4. Subscriptions ────────────────────────────────────────────────────
  step('4 / Subscriptions')
  const subs: any[] = await japan.$queryRaw`SELECT * FROM "Subscription"`
  let subCount = 0
  for (const s of subs) {
    await sydney.subscription.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id:                   s.id,
        providerId:           s.instructorId ?? s.providerId,
        tier:                 s.tier,
        status:               s.status,
        billingCycle:         s.billingCycle,
        monthlyAmount:        s.monthlyAmount,
        stripeSubscriptionId: s.stripeSubscriptionId ?? null,
        stripeCustomerId:     s.stripeCustomerId     ?? null,
        currentPeriodStart:   s.currentPeriodStart,
        currentPeriodEnd:     s.currentPeriodEnd,
        cancelAtPeriodEnd:    s.cancelAtPeriodEnd,
        trialEndsAt:          s.trialEndsAt          ?? null,
        cancelledAt:          s.cancelledAt          ?? null,
      },
    })
    subCount++
  }
  log(`  Subscriptions: ${subCount} upserted`)

  // ── 5. Bookings ──────────────────────────────────────────────────────────
  step('5 / Bookings')
  const bookings: any[] = await japan.$queryRaw`SELECT * FROM "Booking"`
  let bkCount = 0
  for (const bk of bookings) {
    await sydney.booking.upsert({
      where: { id: bk.id },
      update: {},
      create: {
        id:                   bk.id,
        providerId:           bk.instructorId     ?? bk.providerId,
        customerId:           bk.clientId         ?? bk.customerId         ?? null,
        customerName:         bk.clientName       ?? bk.customerName       ?? null,
        customerPhone:        bk.clientPhone      ?? bk.customerPhone      ?? null,
        customerEmail:        bk.clientEmail      ?? bk.customerEmail      ?? null,
        bookingType:          bk.bookingType      ?? null,
        status:               bk.status,
        startTime:            bk.startTime        ?? null,
        endTime:              bk.endTime          ?? null,
        duration:             bk.duration         ?? null,
        price:                bk.price            ?? 0,
        platformFee:          bk.platformFee      ?? 0,
        providerPayout:       bk.instructorPayout ?? bk.providerPayout     ?? 0,
        commissionRate:       (bk.commissionRate && bk.commissionRate > 1 ? bk.commissionRate / 100 : bk.commissionRate) ?? 0,
        isPaid:               bk.isPaid           ?? false,
        paidAt:               bk.paidAt           ?? null,
        paymentIntentId:      bk.paymentIntentId  ?? null,
        paymentToken:         bk.paymentToken     ?? null,
        // stripeSessionId removed in Sydney schema migration
        stripeRefundId:       bk.stripeRefundId   ?? null,
        pickupAddress:        bk.pickupAddress    ?? null,
        notes:                bk.notes            ?? null,
        isFirstBooking:       bk.isFirstBooking   ?? false,
        isPackageBooking:     bk.isPackageBooking ?? false,
        packageHours:         bk.packageHours     ?? null,
        packageHoursUsed:     bk.packageHoursUsed ?? 0,
        packageHoursRemaining: bk.packageHoursRemaining ?? null,
        packageTotalPaid:     bk.packageTotalPaid ?? null,
        packageExpiryDate:    bk.packageExpiryDate ?? null,
        packageStatus:        bk.packageStatus    ?? null,
        source:               bk.source           ?? 'platform',
        customerRating:       bk.clientRating     ?? bk.customerRating     ?? null,
        customerReview:       bk.clientReview     ?? bk.customerReview     ?? null,
        deletedAt:            bk.deletedAt        ?? null,
        cancelledAt:          bk.cancelledAt      ?? null,
        actualDuration:       bk.actualDuration   ?? null,
        timezone:             bk.timezone         ?? null,
        createdAt:            bk.createdAt        ?? new Date(),
        updatedAt:            bk.updatedAt        ?? new Date(),
      },
    })
    bkCount++
  }
  log(`  Bookings: ${bkCount} upserted`)

  // ── 6. Transactions ──────────────────────────────────────────────────────
  step('6 / Transactions')
  const txs: any[] = await japan.$queryRaw`SELECT * FROM "Transaction"`
  let txCount = 0
  for (const tx of txs) {
    await sydney.transaction.upsert({
      where: { id: tx.id },
      update: {},
      create: {
        id:                   tx.id,
        ...(tx.bookingId ? { booking: { connect: { id: tx.bookingId } } } : {}),
        providerId:           (tx as any).instructorId ?? (tx as any).providerId,
        type:                 tx.type,
        amount:               tx.amount,
        currency:             tx.currency             ?? 'AUD',
        status:               tx.status,
        stripePaymentIntentId: tx.stripePaymentIntentId ?? null,
        stripeChargeId:       (tx as any).stripeChargeId   ?? null,
        stripeTransferId:     (tx as any).stripeTransferId  ?? null,
        platformFee:          (tx as any).platformFee       ?? null,
        providerPayout:       (tx as any).instructorPayout  ?? (tx as any).providerPayout ?? null,
        refundAmount:         (tx as any).refundAmount      ?? null,
        failureReason:        (tx as any).failureReason     ?? null,
        metadata:             tx.metadata             ?? null,
        createdAt:            tx.createdAt            ?? new Date(),
        updatedAt:            tx.updatedAt            ?? new Date(),
      },
    })
    txCount++
  }
  log(`  Transactions: ${txCount} upserted`)

  // ── 7. ClientWallet ──────────────────────────────────────────────────────
  step('7 / ClientWallet')
  const wallets: any[] = await japan.$queryRaw`SELECT * FROM "ClientWallet"`
  let wCount = 0
  for (const w of wallets) {
    await sydney.clientWallet.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id:        w.id,
        userId:    w.userId,
        balance:   w.balance   ?? 0,
        createdAt: w.createdAt ?? new Date(),
        updatedAt: w.updatedAt ?? new Date(),
      },
    })
    wCount++
  }
  log(`  ClientWallet: ${wCount} upserted`)

  // ── 8. WalletTransaction ─────────────────────────────────────────────────
  step('8 / WalletTransaction')
  const wtxs: any[] = await japan.$queryRaw`SELECT * FROM "WalletTransaction"`
  let wtCount = 0
  for (const wt of wtxs) {
    await (sydney as any).walletTransaction.upsert({
      where: { id: wt.id },
      update: {},
      create: {
        id:          wt.id,
        walletId:    wt.walletId,
        type:        wt.type,
        amount:      wt.amount,
        description: wt.description  ?? null,
        bookingId:   wt.bookingId    ?? null,
        metadata:    wt.metadata     ?? null,
        createdAt:   wt.createdAt    ?? new Date(),
      },
    })
    wtCount++
  }
  log(`  WalletTransaction: ${wtCount} upserted`)

  // ── 9. Notifications ─────────────────────────────────────────────────────
  step('9 / Notifications')
  const notifs: any[] = await japan.$queryRaw`SELECT * FROM "Notification"`
  let nCount = 0
  for (const n of notifs) {
    await sydney.notification.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id:        n.id,
        userId:    n.userId,
        type:      n.type,
        title:     n.title,
        message:   n.message,
        link:      n.link      ?? null,
        isRead:    n.isRead    ?? false,
        metadata:  n.metadata  ?? null,
        createdAt: n.createdAt ?? new Date(),
      },
    })
    nCount++
  }
  log(`  Notifications: ${nCount} upserted`)

  // ── 10. AuditLog ─────────────────────────────────────────────────────────
  step('10 / AuditLog')
  const audits: any[] = await japan.$queryRaw`SELECT * FROM "AuditLog"`
  let aCount = 0
  for (const a of audits) {
    await sydney.auditLog.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id:           a.id,
        action:       a.action,
        actorId:      a.actorId,
        actorRole:    a.actorRole,
        targetType:   a.targetType,
        targetId:     a.targetId,
        ipAddress:    a.ipAddress    ?? null,
        userAgent:    a.userAgent    ?? null,
        metadata:     a.metadata     ?? null,
        success:      a.success      ?? true,
        errorMessage: a.errorMessage ?? null,
        createdAt:    a.createdAt    ?? new Date(),
      },
    })
    aCount++
  }
  log(`  AuditLog: ${aCount} upserted`)

  // ── 11. WebhookEvent ─────────────────────────────────────────────────────
  step('11 / WebhookEvent')
  const events: any[] = await japan.$queryRaw`SELECT * FROM "WebhookEvent"`
  let eCount = 0
  for (const ev of events) {
    await (sydney as any).webhookEvent.upsert({
      where: { id: ev.id },
      update: {},
      create: {
        id:             ev.id,
        idempotencyKey: ev.idempotencyKey,
        eventType:      ev.eventType,
        stripeEventId:  ev.stripeEventId,
        metadata:       ev.metadata     ?? null,
        processedAt:    ev.processedAt  ?? new Date(),
      },
    })
    eCount++
  }
  log(`  WebhookEvent: ${eCount} upserted`)

  // ── 12. LedgerEntry ──────────────────────────────────────────────────────
  step('12 / LedgerEntry')
  const ledger: any[] = await japan.$queryRaw`SELECT * FROM "LedgerEntry"`
  let lCount = 0
  for (const le of ledger) {
    await (sydney as any).ledgerEntry.upsert({
      where: { id: le.id },
      update: {},
      create: {
        id:            le.id,
        type:          le.type,
        amount:        le.amount,
        currency:      le.currency      ?? 'AUD',
        referenceId:   le.referenceId,
        referenceType: le.referenceType,
        providerId:    le.instructorId  ?? le.providerId ?? null,
        description:   le.description  ?? null,
        metadata:      le.metadata     ?? null,
        createdAt:     le.createdAt    ?? new Date(),
      },
    })
    lCount++
  }
  log(`  LedgerEntry: ${lCount} upserted`)

  // ── 13. PlatformLedger (singleton) ───────────────────────────────────────
  step('13 / PlatformLedger')
  const pl: any[] = await japan.$queryRaw`SELECT * FROM "PlatformLedger"`
  for (const p of pl) {
    await (sydney as any).platformLedger.upsert({
      where: { key: p.key ?? 'default' },
      update: {
        totalCollected:   p.totalCollected   ?? 0,
        totalReserved:    p.totalReserved    ?? 0,
        totalPaidOut:     p.totalPaidOut     ?? 0,
        totalRefunded:    p.totalRefunded    ?? 0,
        totalTaxWithheld: p.totalTaxWithheld ?? 0,
      },
      create: {
        id:               p.id,
        key:              p.key ?? 'default',
        totalCollected:   p.totalCollected   ?? 0,
        totalReserved:    p.totalReserved    ?? 0,
        totalPaidOut:     p.totalPaidOut     ?? 0,
        totalRefunded:    p.totalRefunded    ?? 0,
        totalTaxWithheld: p.totalTaxWithheld ?? 0,
      },
    })
  }
  log(`  PlatformLedger: 1 upserted`)

  // ── 14. PlatformSettings (singleton) ─────────────────────────────────────
  step('14 / PlatformSettings')
  const ps: any[] = await japan.$queryRaw`SELECT * FROM "PlatformSettings"`
  for (const p of ps) {
    await (sydney as any).platformSettings.upsert({
      where: { key: p.key ?? 'default' },
      update: {},
      create: {
        id:                     p.id,
        key:                    p.key ?? 'default',
        basicCommissionRate:    p.basicCommissionRate    ?? 15,
        proCommissionRate:      p.proCommissionRate      ?? 12,
        studioCommissionRate:   p.studioCommissionRate   ?? 11,
        businessCommissionRate: p.businessCommissionRate ?? 10,
      },
    })
  }
  log(`  PlatformSettings: 1 upserted`)

  // ── 15. BookingIdempotencyKey ─────────────────────────────────────────────
  step('15 / BookingIdempotencyKey')
  const ikeys: any[] = await japan.$queryRaw`SELECT * FROM "BookingIdempotencyKey"`
  let ikCount = 0
  for (const ik of ikeys) {
    await (sydney as any).bookingIdempotencyKey.upsert({
      where: { key: ik.key },
      update: {},
      create: {
        key:       ik.key,
        bookingId: ik.bookingId,
        response:  ik.response,
        email:     ik.email     ?? '',
        createdAt: ik.createdAt ?? new Date(),
      },
    })
    ikCount++
  }
  log(`  BookingIdempotencyKey: ${ikCount} upserted`)

  // ── 16. LoginDevice ───────────────────────────────────────────────────────
  step('16 / LoginDevice')
  const devices: any[] = await japan.$queryRaw`SELECT * FROM "LoginDevice"`
  let dCount = 0
  for (const d of devices) {
    await sydney.loginDevice.upsert({
      where: { id: d.id },
      update: {},
      create: {
        id:          d.id,
        userId:      d.userId,
        fingerprint: d.fingerprint,
        lastUsedAt:  d.lastUsedAt  ?? new Date(),
        firstSeenAt: d.firstSeenAt ?? new Date(),
        ipAddress:   d.ipAddress,
        userAgent:   d.userAgent,
        trusted:     d.trusted     ?? false,
      },
    })
    dCount++
  }
  log(`  LoginDevice: ${dCount} upserted`)

  // ── 17. AvailabilityException ─────────────────────────────────────────────
  step('17 / AvailabilityException')
  const avex: any[] = await japan.$queryRaw`SELECT * FROM "AvailabilityException"`
  let avCount = 0
  for (const av of avex) {
    await sydney.availabilityException.upsert({
      where: { id: av.id },
      update: {},
      create: {
        id:            av.id,
        providerId:    av.instructorId ?? av.providerId,
        exceptionDate: av.exceptionDate,
        reason:        av.reason       ?? null,
        createdAt:     av.createdAt    ?? new Date(),
        updatedAt:     av.updatedAt    ?? new Date(),
      },
    })
    avCount++
  }
  log(`  AvailabilityException: ${avCount} upserted`)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════╗')
  console.log('║  Migration complete               ║')
  console.log(`║  Finished: ${new Date().toISOString().substring(0, 19)} ║`)
  console.log('╚══════════════════════════════════╝')

  await japan.$disconnect()
  await sydney.$disconnect()
}

run().catch(e => {
  console.error('\n❌ Migration error:', e.message)
  japan.$disconnect()
  sydney.$disconnect()
  process.exit(1)
})
