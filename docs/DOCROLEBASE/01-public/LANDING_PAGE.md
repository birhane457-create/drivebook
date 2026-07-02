# Landing Page — drivebook.com.au

**Route:** `/` (app/page.tsx)  
**Audience:** Learner drivers + parents (primary), instructors (secondary — footer only)  
**Last Updated:** July 2026  

---

## Page Structure (top to bottom)

| Section | Content | Notes |
|---------|---------|-------|
| Nav | Logo (D-mark + wordmark), About, Contact, Blog, For Instructors, Login, Sign Up | Mobile hamburger menu. Logo uses `<Logo size={36} />` component |
| Hero | "Pass Your Driving Test with Confidence" + 5 bullets + CTA | Learner-focused only |
| Trust Badge | Single green badge — background-checked, licensed & approved | One instance only — no repetition |
| AI Phone Booking | "Book by Phone — AI Answers 24/7" + AIReceptionistShowcase | Primary differentiator, above Why Choose |
| Why Choose DriveBook | 6 cards: Trusted & Approved, Book in Seconds, Flexible Packages, Smart Reminders, Track Progress, Test Prep | Learner-focused |
| Progress Dashboard | ProgressTrackingShowcase + explainer sentence | Explains HOW data is generated |
| How It Works | BookingFlowShowcase — 4 steps | Search → Book → Confirm → Track |
| Quick Summary | 4-step amber box | Mirrors the 4-step flow |
| What You Get | 4 feature tiles | Payment, Test Prep, Progress, Confirmation |
| FAQ | 6 questions | Trust, cancellation, payment, packages, choice, contact |
| CTA | "Book Your First Lesson" + optional phone CTA | Instructor link in footer only |
| Footer | 4-column: DriveBook (logo), Company, Resources, Legal, Get Started | Resources column added July 2026 |

---

## Key Copy Decisions

### Hero bullets (5 items)
```
🎯 Smart booking with real-time availability — no waiting, no phone tag
📍 Location-based matching to find instructors who service your area
💰 Save up to 12% with bulk hour packages and test preparation bundles
📞 Book by phone — AI answers 24/7, no app download needed
📱 Manage everything 24/7 from your personal dashboard
```

### Trust — appears ONCE only
The green trust badge below the hero is the single authoritative trust signal. "Verified" does not appear in the hero subheading or bullets. Repeating the same claim triggers the overjustification effect.

### AI Phone Booking — positioned as primary differentiator
Sits immediately after the trust badge, before "Why Choose DriveBook". The "no app download required" message is the headline — this is the key friction reducer vs competitors.

### Progress Dashboard explainer
Below the section heading, a one-sentence explainer:
> "After every lesson, your instructor logs your performance directly into DriveBook — giving you personalised feedback on exactly what to work on next."

This grounds the dashboard data in human action (instructor logs it), not an algorithm.

### Testimonials — learner/parent only
- Sarah M., Perth — passed first try
- Linda R., Parent — safety and verification focus
- Michael K., New Driver — bulk package + SMS reminders

James T. (Driving Instructor) quote was removed. It belongs on `/teach-with-drivebook` as B2B copy.

### CTA button text
Hero: "Book Your First Lesson →"  
Bottom CTA section: "Find Your Instructor →"

---

## Footer (July 2026 update)

The footer now has 5 columns (DriveBook brand, Company, Resources, Features, Legal/Get Started):

```
Company              Resources            Features
──────               ─────────            ────────
About Us             Learn to Drive       AI Receptionist
Contact              WA PDA Guide         Online Booking
For Instructors      Instructor Hub       Custom Domain
Platform Guide       Blog                 Payments
                                          Student Progress
                                          Multi-Instructor
```

The DriveBook brand name in the footer is rendered using `<Logo size={28} dark />`.

---

## Navigation Entry Points (July 2026)

Feature and comparison pages are surfaced from:

| Page | What's linked |
|------|--------------|
| Homepage footer | Features column — all 6 feature pages |
| `/teach-with-drivebook` | "Explore Every Feature" section + 3 compare links |
| `/for-instructors` capability strip | Each icon links to its feature page |
| `/for-instructors` CTA area | "Comparing options?" row — 3 compare links |

---

## Components Used

| Component | File | Purpose |
|-----------|------|---------|
| AIReceptionistShowcase | `components/landing/AIReceptionistShowcase.tsx` | Animated AI phone booking demo |
| ProgressTrackingShowcase | `components/landing/ProgressTrackingShowcase.tsx` | 3-slide dashboard demo |
| BookingFlowShowcase | `components/landing/BookingFlowShowcase.tsx` | 5-step booking flow demo |

Note: `TrustSafetyShowcase` and `PackagePricingShowcase` are no longer rendered on the homepage (removed to reduce repetition and page weight).

---

## Instructor Acquisition

Instructors are NOT a primary audience on this page. The only instructor-facing touchpoints are:

1. "For Instructors" link in the nav → `/teach-with-drivebook`
2. Footer CTA: "Are you a driving instructor? Learn how DriveBook can grow your business →"

This keeps the learner conversion funnel uninterrupted.

---

## Currency & Pricing

All prices displayed in AUD with `$` symbol. No £ signs anywhere on the platform.

---

## What NOT to do

- Do not add instructor testimonials to this page
- Do not repeat the safety/verification claim more than once
- Do not add a "For Instructors" section in the main content flow
- Do not hardcode instructor counts in demo components (use "Instructors Near You" instead)
