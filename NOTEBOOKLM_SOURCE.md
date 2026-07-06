# DriveBook AI Receptionist — NotebookLM Source Document

**Purpose:** This document is the complete source for generating a NotebookLM audio overview of the DriveBook AI Receptionist feature. Upload this single file to NotebookLM and use the prompt at the bottom.

---

## What is DriveBook?

DriveBook is an Australian driving instructor platform built for Western Australia. It handles everything a driving school needs: bookings, payments, student progress tracking, scheduling, and now — an AI receptionist that answers calls 24 hours a day, 7 days a week.

Instructors sign up, set their hourly rate, their availability, their service area, and their vehicle types. Students find them, book lessons, and pay through the platform. The AI receptionist sits on top of all of this and handles the phone calls so instructors don't have to.

---

## The Platform — What it Looks Like

The DriveBook dashboard has a dark navy interface. Deep slate background, white text, violet and pink gradient accents. It feels modern and professional — not like typical small business software.

When an instructor logs in they see:
- Upcoming lessons
- This month's revenue with a trend comparison to last month
- Clients who have unused package hours and need follow-up
- Their AI Receptionist line — the dedicated phone number that the AI answers

The colour scheme pulls from the logo: indigo at #4338CA flowing into violet #7C3AED then pink #EC4899. The steering wheel icon in the logo is amber gold. The wordmark says "Drive" in dark navy and "Book" in the violet-pink gradient. Tagline: Learn. Drive. Succeed.

---

## What the AI Receptionist Does

The AI receptionist is a voice AI that answers phone calls on behalf of driving instructors. When a student calls the instructor's dedicated DriveBook number, the AI picks up immediately — no voicemail, no waiting, no missed bookings.

It handles three things:

**1. New bookings**
The AI asks where the student is, finds available instructors near them, checks live availability, presents package pricing, collects name, email and phone, confirms everything out loud before acting, then creates the booking and sends a payment link by SMS — all in one call.

**2. Cancellations**
The AI looks up the booking, checks the refund policy, states the exact dollar refund amount out loud before doing anything, sends a verification code to confirm identity, gets a final verbal yes, then cancels and processes the refund.

**3. Reschedules**
Same identity verification, then finds a new available slot, reads back the change, gets verbal confirmation, then moves the booking and sends an updated confirmation.

---

## How It Handles Real-World Complexity

The AI is not a simple phone tree. It handles situations that would normally require a human:

**Short-notice bookings:** If a student tries to book a lesson starting within two hours, the AI flags it as short notice and puts the booking into a pending state waiting for the instructor to approve it — rather than just selling a slot the instructor physically cannot make.

**Call drop recovery:** If a student's call drops mid-booking, they call back and the AI immediately says: "Welcome back — I can see you were booking with Debesay just before. I've resent your payment link. Anything else?" It resumes exactly where they left off. No starting over.

**Duplicate booking detection:** Before completing a booking, the AI checks if the caller already has a confirmed booking with the same instructor on the same date and asks if they meant to add another lesson or if they want to change the existing one.

**Payment confirmation:** When a student says "I just paid" the AI polls the payment status in real time — checking up to three times with a five second gap — and confirms the booking as soon as Stripe confirms the payment. It never guesses. It never pretends.

**Instructor not available:** If an instructor is fully booked for the next week, the AI offers two options — a different instructor nearby, or checking if the same instructor has availability in two to three weeks. It does not give up.

---

## Zero Configuration for Instructors

The instructor does nothing to set up the AI receptionist. Zero. The AI reads everything directly from their existing DriveBook profile:

- Their name — for the greeting: "Hi, you've reached Sarah's booking line"
- Their hourly rate — for quoting accurate prices
- Their working hours — for checking real availability
- Their service area — for filtering relevant instructors
- Their vehicle types — so it can match manual or automatic requests
- Their languages — so it can find language-matched instructors
- Their PDA test pack — so it knows if they offer driving test preparation

When an instructor upgrades to the PRO plan, the platform automatically assigns them a dedicated Twilio phone number from the pool. From that moment, calls to that number go to their personal AI receptionist. No scripts to write, no training required, no configuration panel to navigate.

---

## Full Live Conversation Scenarios

### Scenario 1 — New Booking, General Line, No Preference

*A learner driver in Joondalup calls the DriveBook general number on a Saturday morning.*

**AI:** Hi, thanks for calling DriveBook. I can help you find an instructor and book a lesson, or manage an existing booking. What would you like to do?

**Student:** I need to book a driving lesson.

**AI:** Great. What suburb are you in?

**Student:** Joondalup.

**AI:** Do you have a preferred instructor, or would you like me to find someone near you?

**Student:** Just find me someone good.

**AI:** I have three instructors available near Joondalup. Debesay is top rated at $75 an hour, Michael is the most affordable at $65, and Sarah has the earliest availability this week. Who sounds good?

**Student:** Debesay please.

**AI:** Perfect. What day works best for you?

**Student:** Saturday.

**AI:** Debesay has Saturday at 10am and 1pm available. Which would you prefer?

**Student:** 10am.

**AI:** And are you after a single lesson or a package?

**Student:** What's the package deal?

**AI:** The 10-hour package with Debesay is $710 — that's about a 10 percent saving compared to booking lesson by lesson, and it locks in your rate. There's also a 6-hour option at $427.

**Student:** I'll go with 10 hours.

**AI:** Great. I'll need a few details. What's your name?

**Student:** Emma Clarke.

**AI:** And your email?

**Student:** emma.clarke@gmail.com

**AI:** And your mobile?

**Student:** 0412 345 678.

**AI:** Just to confirm — 10 hours with Debesay, first lesson Saturday at 10am, pickup in Joondalup, total $710, payment link to 0412 345 678. Is that all correct?

**Student:** Yes, that's right.

**AI:** Done. Payment link sent to your phone. Your slot is held for 10 minutes while you complete payment. Enjoy your lessons, Emma.

---

### Scenario 2 — Cancellation, Dedicated Line, Within Refund Window

*A student calls their instructor's dedicated number on a Tuesday morning wanting to cancel a Thursday lesson.*

**AI:** Hi, you've reached Sarah's booking line. I'm the DriveBook assistant. I can help you book a lesson, change an existing booking, or cancel. What can I help you with today?

**Student:** I need to cancel my lesson on Thursday.

**AI:** I can help with that. What phone number is the booking under?

**Student:** 0423 456 789.

**AI:** I found a booking with Sarah on Thursday the 10th at 9am, pickup at 45 Ocean Reef Road. Is that the one?

**Student:** Yes, that's it.

**AI:** Cancelling this lesson now — with more than 48 hours notice — means you'll receive a full refund of $75. Before I send you a verification code, would you like to go ahead?

**Student:** Yes please.

**AI:** I've sent a 6-digit code to 0423 456 789. What's the code?

**Student:** 4-8-2-1-9-3.

**AI:** Got it. Just to confirm — cancelling your lesson with Sarah on Thursday the 10th at 9am, and you'll receive a $75 refund. Shall I go ahead?

**Student:** Yes.

**AI:** Done. Your booking is cancelled and a $75 refund will be returned to your wallet within a few minutes. Is there anything else I can help with?

**Student:** No, that's everything. Thanks.

**AI:** No problem. Have a good day.

---

### Scenario 3 — Call Drop Recovery

*A student was mid-booking, their call dropped, and they ring back 4 minutes later.*

**AI:** Welcome back. I can see you were booking a lesson with Debesay about 4 minutes ago. I've resent your payment link to your number. Would you like me to do anything else?

**Student:** Oh perfect, I thought I'd have to start over. No that's great.

**AI:** Not at all — your slot is still held. You've got about 6 minutes left to complete payment. Is there anything else I can help with?

**Student:** No that's brilliant, thank you.

**AI:** Great. Enjoy your lesson.

---

### Scenario 4 — Reschedule

*A student needs to move their lesson from Friday to next Monday.*

**AI:** Hi, you've reached Michael's booking line. I'm the DriveBook assistant. How can I help?

**Student:** I need to move my lesson.

**AI:** Of course. What number is the booking under?

**Student:** 0411 222 333.

**AI:** I found a booking with Michael on Friday the 12th at 2pm. Is that the one you'd like to move?

**Student:** Yes.

**AI:** I'll send a verification code to 0411 222 333 to confirm your identity. Ready?

**Student:** Yes go ahead.

**AI:** What's the 6-digit code?

**Student:** 7-3-9-1-4-6.

**AI:** Verified. What day would you like to move to?

**Student:** Next Monday.

**AI:** Michael has Monday the 15th at 10am and 3pm available. Which would you prefer?

**Student:** 10am.

**AI:** I'll move your lesson from Friday the 12th at 2pm to Monday the 15th at 10am. Shall I go ahead?

**Student:** Yes.

**AI:** Done. Your lesson has been moved to Monday the 15th at 10am. You'll receive an updated confirmation by SMS. Is there anything else I can help with?

**Student:** No, perfect. Thank you.

---

## The Business Case

**For instructors:** Every missed call is a missed booking. The average driving lesson package is $710. An instructor teaching full time might miss 3 to 5 calls a week — evenings, during lessons, weekends. At $710 a conversion, that is $2,000 to $3,500 a week in bookings that either went to a competitor or just evaporated because voicemail got in the way.

**For students:** They can book at 9pm on a Sunday. They don't have to call back during business hours. They don't have to remember what they said in a voicemail. The AI handles everything in the same call.

**The zero-setup advantage:** Unlike a human receptionist or a phone answering service, there is no briefing required. The AI reads from the instructor's live schedule in real time. If the instructor changes their hourly rate at 8am, the AI is quoting the new rate by 8:01am.

---

## Subscription Plans

- **BASIC / TRIAL:** Uses the shared DriveBook general line. Students call a DriveBook number and the AI helps them find any instructor by location or preference.
- **PRO:** Gets a dedicated Twilio number automatically assigned. Calls go to that instructor's personal AI receptionist. Students call the instructor's own number and hear their name in the greeting.
- **STUDIO / BUSINESS:** Same dedicated line, with additional features like custom branding on the booking page and subdomain support.

The dedicated phone number is provisioned automatically when the instructor upgrades. It appears in their dashboard the moment it's ready. No support ticket needed, no form to fill out.

---

## NotebookLM Generation Prompt

*Use this prompt after uploading this document:*

**"Generate an audio overview of this document as a natural, engaging conversation between two hosts. One host is a tech-savvy product person who understands how the system works. The other host plays the role of a driving instructor who is hearing about this for the first time and asks practical, real-world questions. Cover: what the AI receptionist does, how the call scenarios actually play out in real conversations, why instructors don't need to configure anything, the call recovery feature, and what this means for missed bookings and revenue. Use the full conversation transcripts as examples — read key exchanges out loud in the discussion. Keep the tone warm, conversational, and Australian."**
