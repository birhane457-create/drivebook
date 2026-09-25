# DriveBook Membership — Product Blueprint

**Version:** 0.1
**Stage:** PRODUCT REVIEW
**Implementation:** NOT AUTHORIZED

## 1. Product definition

Membership is a separate DriveBook product line designed to give drivers an ongoing reason to remain connected to DriveBook after lessons.

The core value exchange is:

```
MEMBER
  ↓
gets genuine discount / offer
  ↓
PARTNER
  ↓
gets customer
  ↓
pays DriveBook
```

## 2. Member value

Membership must provide tangible economic value. A membership without useful savings or benefits does not provide a strong reason to remain enrolled.

Possible benefits:

- Insurance offers or referral benefits.
- Fuel offers.
- Vehicle servicing and tyre discounts.
- Dealership offers.
- Roadside assistance offers.
- Tax/accounting partner offers where appropriate.
- Other verified driver-service benefits.

Only benefits supported by real partner agreements should be presented as member benefits.

## 3. Partner value and revenue

Partners participate because DriveBook can bring them customers.

Potential commercial models:

- Percentage-based referral or commission arrangement.
- Fixed fee per qualified lead.
- Fixed fee per converted customer.
- Recurring referral commission where commercially appropriate.

The backend should eventually support partner-specific commercial terms rather than one global commission rule.

## 4. Membership tiers

### MVP

**FREE** — no member payment.

### Future

**PREMIUM** — possible paid membership after member demand and partner benefits are validated.

Premium benefits, price, billing rules and eligibility are intentionally undefined at this stage.

Preferred future payment direction: reuse existing DriveBook payment infrastructure with a Membership-specific subscription layer rather than building a second payment system.

## 5. MVP validation loop

The first implementation should prove one complete commercial loop before building a large marketplace:

`Member → Offer → Referral → Conversion → Attribution → DriveBook revenue`

Start with a real partner relationship rather than implementing every possible partner category speculatively.

## 6. Proposed bounded domain

Future Membership-specific design should remain conceptually grouped around:

- Membership
- MembershipPartner
- MembershipOffer
- MembershipReferral
- PartnerConversion
- PartnerCommission / PartnerPayout

These are design concepts only. No schema implementation is authorized in this stage.

## 7. Existing-system dependencies

| Existing system | Intended relationship | Rule |
|---|---|---|
| `User` | identifies the member | Reuse; do not create a second user identity system |
| Existing authentication | member access | Reuse; document the dependency |
| Existing payment / Stripe | future Premium billing | Reuse later with Membership subscription layer |
| Existing audit/logging | sensitive Membership actions | Reuse where required by policy |
| Existing booking/payment/wallet domains | generally independent | Do not modify merely to support Membership MVP |

Any future exception must be recorded in a Membership architecture decision document.

## 8. Explicitly out of MVP

- Paid membership.
- Membership AI.
- Large multi-category marketplace.
- Complex loyalty points.
- Full vehicle-management platform.
- Automatic settlement for every commercial model.
- Category-specific integrations before partner validation.

## 9. Approval gates

Before implementation:

1. Core application stable baseline selected.
2. Membership product review completed.
3. First partner/commercial assumption validated.
4. MVP architecture approved.
5. Data and privacy boundaries approved.
6. Engineering ownership explicitly assigned.