# Copilot Studio Integration Guide - Natural Conversation Flow

## Philosophy: Conversational, Not Interrogative

The AI should feel like talking to a helpful receptionist, not filling out a form.

### Core Principles

1. **Flexible Input** - Accept information in any order
2. **Smart Inference** - Don't ask what we can figure out
3. **Top 3 Only** - Never list more than 3 options
4. **Natural Upsell** - Mention savings, don't push
5. **Smooth Flow** - Minimize back-and-forth

---

## Perfect Conversation Flow

### Opening: Get Location (Required)

```
AI: "Hi! Welcome to DriveBook. Where would you like to be picked up for your lesson?"
```

**What AI Listens For:**
- Location: "Joondalup", "123 Main St, Maylands", "6027"
- Instructor preference: "with Debesay", "I want Sarah"
- Time preference: "next Monday", "tomorrow morning", "ASAP"
- Package interest: "10 hours", "package deal"

**AI Extracts Everything Mentioned:**
```javascript
{
  location: "Joondalup",
  preferredInstructor: "Debesay" (if mentioned),
  timePreference: "next Monday" (if mentioned),
  packageInterest: true (if mentioned)
}
```

---

### Step 1: Handle Instructor Preference

#### Scenario A: User Mentioned Instructor Name/Phone

```
User: "I want to book with Debesay" or "My instructor is 0400123456"

AI: [Calls /api/instructors/search with name or phone]
    "Great! Debesay is one of our top-rated instructors. 
     Where would you like to be picked up?"
```

**If instructor found:**
- Skip recommendations
- Proceed to availability

**If instructor not found or doesn't serve area:**
```
AI: "I couldn't find that instructor in [location]. 
     Let me show you 3 excellent instructors who serve your area instead."
```

#### Scenario B: User Didn't Mention Instructor (MOST COMMON)

```
AI: [Calls /api/locations/validate]
    [If valid, calls /api/instructors/recommendations?location=X&limit=3]
    
    "Perfect! I found 3 great instructors near [location]:
    
    • Debesay - Top rated (4.9★, $75/hr, 2.1km away)
    • Michael - Best value ($70/hr, 4.7★)
    • Sarah - Closest (1.8km, $80/hr, 4.8★)
    
    Most students choose Debesay. Would you like to book with him?"
```

**User Response Options:**
- "Yes" / "Sure" / "Sounds good" → Book with #1 (Debesay)
- "The second one" / "Michael" → Book with #2
- "Tell me more about Sarah" → Provide details about #3
- "Show me others" → "These are the best 3 in your area. Which one interests you?"

---

### Step 2: Check Availability + Offer Package

```
AI: "Great choice! When would you like your first lesson?"

User: "Next Monday morning" or "Tomorrow" or "As soon as possible"

AI: [Calls /api/availability/slots with date range]
    [Calls /api/packages?instructorId=X]
    
    "I have Monday at 9am available. 
    
    By the way, most students choose the 10-hour package - 
    it's $675 instead of $750, so you save $75. 
    
    Would you like the 10-hour package, or just a single lesson?"
```

**Package Response Options:**
- "10 hours" / "Package" / "Yes" → Proceed with PACKAGE_10
- "6 hours" → Proceed with PACKAGE_6
- "15 hours" → Proceed with PACKAGE_15
- "Single lesson" / "Just one" → Proceed with 1-hour booking
- "What are my options?" → Show all 3 packages with savings

**Package Presentation (if asked):**
```
AI: "Here are your options:
    
    • 6 hours - $427 (save $23, 5% off)
    • 10 hours - $675 (save $75, 10% off) ⭐ Most popular
    • 15 hours - $990 (save $135, 12% off)
    
    Which package works best for you?"
```

---

### Step 3: Booking Type (Schedule Now or Later)

```
AI: "Would you like to schedule your lessons now, 
     or buy the hours and schedule them later?"
```

**Response Options:**
- "Schedule now" / "Now" → bookingType: 'now' (ask for schedule)
- "Later" / "I'll schedule later" → bookingType: 'later' (skip scheduling)

**If "Schedule Now":**
```
AI: "Perfect! Let's schedule your first lesson for Monday at 9am.
     
     I'm holding this time slot for you for the next 10 minutes 
     while we complete your booking.
     
     Would you like to schedule more lessons now, or just the first one?"
```

**If "Later":**
```
AI: "No problem! You'll have 10 hours of credit in your account,
     and you can schedule lessons anytime through our website or by calling back.
     
     Your credits are valid for 365 days."
```

---

### Step 4: Get Account Details (Smooth & Natural)

```
AI: "Great! I just need a few details to create your account.
     
     Can I get your name, email, and phone number?"
```

**User Provides (in any order):**
- "John Smith, john@email.com, 0400123456" ✅ All at once
- "John Smith" → AI: "And your email and phone?"
- "john@email.com" → AI: "Thanks! And your name and phone number?"

**AI Extracts:**
```javascript
{
  accountHolderName: "John Smith",
  accountHolderEmail: "john@email.com",
  accountHolderPhone: "0400123456"
}
```

**Important: NO PASSWORD ASKED**
```
AI: "Perfect! I'll send your account password to your phone and email 
     after we complete the booking."
```

---

### Step 5: Registration Type (Optional)

**Only ask if context suggests booking for someone else:**

```
User: "I'm booking for my daughter" or "It's for my son"

AI: "Got it! Is this lesson for you, or for someone else?"

If "Someone else":
  AI: "What's the learner's name and phone number?"
  
  [Collect learnerName, learnerPhone, learnerRelationship]
```

**If not mentioned, assume "myself"**

---

### Step 6: Confirm & Payment

```
AI: "Perfect! Here's your booking summary:
    
    • Instructor: Debesay (4.9★)
    • Package: 10 hours (save $75!)
    • First lesson: Monday, March 10th at 9am
    • Pickup: Joondalup
    • Total: $675
    
    I'm holding your time slot for the next 10 minutes.
    
    You'll receive:
    • SMS with your account password
    • Email with booking confirmation
    • Payment link to complete your booking
    
    Once payment is processed, your lesson is confirmed!
    
    I'll send the payment link to john@email.com now. 
    Is there anything else I can help with?"
```

---

## API Call Sequence

### Flexible Flow (Adapts to User Input)

```javascript
// 1. User provides location
validateLocation(pickupLocation)

// 2. Check if instructor mentioned
if (instructorNameOrPhone) {
  lookupInstructor(nameOrPhone)
  if (found && servesArea) {
    selectedInstructor = instructor
  } else {
    getRecommendations(location, limit=3)
  }
} else {
  getRecommendations(location, limit=3)
}

// 3. User selects instructor (or AI suggests #1)
selectedInstructor = userChoice || recommendations[0]

// 4. Check availability + Get packages
availability = getAvailableSlots(instructorId, date, duration=60)
packages = getPackages(instructorId)

// 5. Present package with savings
presentPackageOptions(packages, highlight="PACKAGE_10")

// 6. User selects package
selectedPackage = userChoice || "PACKAGE_10"

// 7. Booking type
bookingType = userChoice || "now" // Default to schedule now

// 8. If "now", collect schedule
if (bookingType === "now") {
  scheduledBookings = [{
    date: "2026-03-10",
    time: "09:00",
    duration: 60,
    pickupLocation: validatedLocation,
    notes: "First lesson"
  }]
}

// 9. Collect account details
accountDetails = {
  accountHolderName,
  accountHolderEmail,
  accountHolderPhone,
  // NO PASSWORD - backend generates
}

// 10. Create booking
createBooking({
  instructorId,
  packageType: selectedPackage,
  hours: packageHours,
  includeTestPackage: false,
  bookingType,
  scheduledBookings,
  registrationType: "myself",
  ...accountDetails,
  pricing: calculatePricing(selectedPackage, instructorRate)
})

// 11. Send confirmation
sendConfirmation(email, phone, bookingId)
```

---

## Critical Features

### 1. Time Slot Hold (10 Minutes)

```
When AI calls /api/availability/slots and user selects a time:
- Slot is "soft reserved" for 10 minutes
- User has 10 minutes to complete payment
- After 10 minutes, slot is released
- AI mentions this: "I'm holding this slot for 10 minutes"
```

**Implementation:**
```javascript
// In booking API
const reservation = {
  instructorId,
  startTime,
  endTime,
  reservedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 min
  status: 'RESERVED'
}
```

### 2. OTP via SMS/Email

```
After booking created:
1. Generate secure password
2. Send SMS: "Your DriveBook password: [password]. Login at drivebook.com.au"
3. Send Email: "Welcome! Your password: [password]. Click here to login: [link]"
4. Send Payment Link: "Complete your booking: [stripe-payment-link]"
```

### 3. Payment Link

```
After booking created (status: PENDING):
1. Create Stripe payment intent
2. Generate payment link
3. Send via email + SMS
4. User completes payment
5. Webhook updates booking status to CONFIRMED
6. Send final confirmation
```

---

## What NOT to Ask

### ❌ Don't Ask These (Backend Handles)

1. **Password** - Backend generates, sends via SMS/email
2. **Pricing** - Backend calculates from package + instructor rate
3. **Platform Fee** - Backend adds automatically
4. **Commission** - Backend calculates
5. **Instructor ID** - AI gets from search/recommendations
6. **Exact coordinates** - Backend geocodes address
7. **Booking ID** - Backend generates
8. **Transaction ID** - Backend generates

### ❌ Don't Ask If User Doesn't Know

1. **Instructor name** - Show recommendations instead
2. **Exact time** - Offer available slots
3. **Package type** - Suggest most popular
4. **Duration** - Default to 1 hour
5. **Vehicle type** - Use instructor's default

---

## Natural Language Examples

### User Says → AI Understands

```
"I need driving lessons" 
  → Get location, show recommendations

"I want Debesay" 
  → Look up instructor, get location

"Next Monday morning" 
  → Check Monday 9am-11am slots

"As soon as possible" 
  → Check next available slot

"10 hours" 
  → Select PACKAGE_10

"Just one lesson" 
  → Single 1-hour booking

"I'm booking for my daughter" 
  → registrationType: "someone-else"

"John Smith, john@email.com, 0400123456" 
  → Extract all three fields

"The cheapest one" 
  → Select instructor with lowest rate

"The closest one" 
  → Select instructor with shortest distance
```

---

## Error Handling

### Location Not Found

```
AI: "I couldn't find that location. Could you be more specific? 
     For example, 'Joondalup WA' or '6027'?"
```

### No Instructors in Area

```
AI: "Unfortunately, we don't have instructors serving [location] yet. 
     The closest area we serve is [nearest-area]. 
     Would you like to see instructors there?"
```

### Time Slot Taken

```
AI: "That time slot was just booked by someone else. 
     I have 10am and 2pm available on Monday. 
     Which works better for you?"
```

### Email Already Exists

```
AI: "It looks like you already have an account with us! 
     Would you like me to send a password reset link to your email?"
```

---

## Copilot Studio Configuration

### 1. Import OpenAPI Spec

```
URL: https://drivebook.com.au/openapi.yaml
```

### 2. System Instructions

Copy from `AI_VOICE_IMPROVED_PROMPT.md`

### 3. Key Settings

```yaml
Conversation Style: Friendly, helpful, conversational
Response Length: Concise (2-3 sentences max)
Tone: Professional but warm
Personality: Helpful receptionist

Features:
- Natural language understanding: ON
- Context retention: ON
- Multi-turn conversations: ON
- Slot filling: FLEXIBLE (not strict)
- Confirmation: ALWAYS (before booking)
```

### 4. Entity Extraction

```yaml
Entities to Extract:
- location (required)
- instructorName (optional)
- instructorPhone (optional)
- timePreference (optional)
- packageType (optional)
- accountHolderName (required)
- accountHolderEmail (required)
- accountHolderPhone (required)
- learnerName (conditional)
- learnerPhone (conditional)
```

---

## Testing Scenarios

### Test 1: Complete Flow (No Instructor Preference)

```
User: "I need driving lessons"
AI: "Where would you like to be picked up?"
User: "Joondalup"
AI: [Shows top 3 recommendations]
User: "The first one sounds good"
AI: "When would you like your lesson?"
User: "Next Monday morning"
AI: [Checks availability, offers package]
User: "10 hours sounds good"
AI: "Schedule now or later?"
User: "Now"
AI: "I need your name, email, and phone"
User: "John Smith, john@email.com, 0400123456"
AI: [Confirms booking, sends payment link]
```

### Test 2: User Knows Instructor

```
User: "I want to book with Debesay"
AI: "Great! Where's your pickup location?"
User: "Maylands"
AI: [Checks availability]
User: "Tomorrow at 2pm"
AI: [Offers package]
User: "10 hours"
AI: "I need your details"
User: "Sarah Johnson, sarah@email.com, 0411222333"
AI: [Confirms booking]
```

### Test 3: User Provides Everything Upfront

```
User: "I need a 10-hour package with Debesay in Joondalup next Monday morning"
AI: [Validates everything, checks availability]
    "Perfect! I have 9am available. I just need your name, email, and phone."
User: "Mike Chen, mike@email.com, 0422333444"
AI: [Confirms booking]
```

---

## Future Enhancements (Phase 2)

### Rescheduling

```
User: "I need to reschedule my lesson"
AI: "Sure! What's your booking reference or phone number?"
User: "0400123456"
AI: [Looks up bookings]
    "I found your lesson with Debesay on Monday at 9am. 
     When would you like to reschedule to?"
```

### Cancellation

```
User: "I need to cancel"
AI: "I can help with that. What's your booking reference?"
User: "BOOK123"
AI: [Looks up booking]
    "I found your lesson on Monday at 9am. 
     Our cancellation policy: 
     - 24+ hours notice: Full refund
     - Less than 24 hours: 50% refund
     
     Would you like to proceed with cancellation?"
```

---

## Summary

✅ Flexible, not strict - AI adapts to user input  
✅ Top 3 recommendations only  
✅ Natural upsell with savings mentioned  
✅ 10-minute time slot hold  
✅ OTP via SMS/email (no password asked)  
✅ Payment link sent automatically  
✅ Smooth, conversational flow  
✅ Minimal back-and-forth  

**Ready to integrate with Copilot Studio!** 🚀



---

## Pro-Tips for Voice Agent Optimization

### 1. Latency Management (Mask API Response Time)

**Problem:** API calls can take 1-3 seconds, creating awkward silence.

**Solution:** Use "filler phrases" while waiting for API response.

```
✅ GOOD:
User: "Joondalup"
AI: "Checking who's available near Joondalup for you now..." 
    [Calls /instructors/recommendations]
    [Response arrives]
    "I found 3 great instructors..."

❌ BAD:
User: "Joondalup"
AI: [Silent for 2 seconds]
    "I found 3 great instructors..."
```

**Filler Phrases by Endpoint:**
- `/locations/validate` → "Let me confirm that location..."
- `/instructors/recommendations` → "Checking who's available near [Location] for you now..."
- `/packages` → "Let me check the package options for [Instructor Name]..."
- `/availability/slots` → "Looking at [Instructor]'s schedule..."
- `/public/bookings/bulk` → "Creating your booking now..."

---

### 2. Ask for Vehicle Preference BEFORE Recommendations

**Why:** Improves recommendation accuracy by filtering instructors who teach that vehicle type.

```
✅ OPTIMAL FLOW:
AI: "Where would you like to be picked up?"
User: "Joondalup"
AI: "Do you prefer an automatic or manual car?"
User: "Automatic"
AI: [Calls /instructors/recommendations?location=Joondalup&vehicleType=AUTO]

❌ SUBOPTIMAL:
AI: "Where would you like to be picked up?"
User: "Joondalup"
AI: [Calls /instructors/recommendations without vehicleType]
    [Shows instructors who might only teach manual]
```

**Implementation:**
```javascript
// After location validated
if (!vehicleTypeProvided) {
  ask("Do you prefer an automatic or manual car?");
  vehicleType = await getUserResponse();
}

recommendations = await getRecommendations({
  location,
  vehicleType, // Filters results
  limit: 3
});
```

---

### 3. Handling "None of the Above" (Fallback Strategy)

**Problem:** User doesn't like top 3 recommendations.

**Solution:** Fallback to `/instructors/search` for full list, but still limit verbal presentation.

```
User: "None of those work for me"

AI: "Let me show you all available instructors in your area..."
    [Calls /instructors/search?location=Joondalup]
    [Returns 15 instructors]
    
    "I have 12 more instructors available. Here are the next 5:
    
    • Alex - 4.6★, $72/hr, 3.2km
    • Emma - 4.5★, $78/hr, 2.8km
    • David - 4.7★, $80/hr, 4.1km
    • Lisa - 4.4★, $70/hr, 5.2km
    • Tom - 4.8★, $85/hr, 3.5km
    
    Would any of these work for you?"
```

**Key Points:**
- Don't read all 15 instructors verbally
- Present 5-7 at a time
- Offer to "hear more" if still not satisfied
- Suggest booking online if user wants to browse all

---

### 4. Emphasize Dollar Savings, Not Percentages

**Why:** Dollar amounts are more tangible and persuasive than percentages.

```
✅ GOOD:
"The 10-hour package saves you $75"
"You'll save $135 with the 15-hour package"

❌ LESS EFFECTIVE:
"The 10-hour package has a 10% discount"
"15% off with the 15-hour package"
```

**Implementation:**
```javascript
// API returns both
{
  "discountPercentage": 10,
  "savings": 75
}

// AI uses savings in conversation
AI: `The 10-hour package is $675 - that saves you $${savings}`
```

---

### 5. Lead with "Most Popular" Package

**Why:** Social proof increases conversion. People trust what others choose.

```
✅ OPTIMAL:
AI: "I recommend the 10-hour package - it's our most popular and saves you $75. 
     Would that work for you?"

❌ SUBOPTIMAL:
AI: "We have 6-hour, 10-hour, and 15-hour packages. Which would you like?"
```

**Only show alternatives if user hesitant:**
```
User: "That's too much"
AI: "No problem! We have a 6-hour package for $427 if you'd like to start smaller."
```

---

### 6. Confirm Vehicle Type Match

**Problem:** User books instructor who doesn't teach their preferred vehicle type.

**Solution:** Confirm match before proceeding.

```
User: "I'll go with Michael"

AI: [Checks instructor.vehicleTypes]
    
    If match:
      "Great! Michael teaches automatic. When would you like your lesson?"
    
    If no match:
      "Just to confirm - Michael teaches manual transmission. 
       You mentioned you prefer automatic. 
       Would you like to choose a different instructor, or is manual okay?"
```

---

### 7. Natural Language Date/Time Parsing

**Accept flexible input:**
```
"Next Monday" → Parse to actual date
"Tomorrow morning" → Parse to next day, 9am-11am range
"ASAP" → Check next available slot
"In 2 weeks" → Parse to date 14 days from now
"Weekday afternoons" → Filter for Mon-Fri, 2pm-5pm
```

**Implementation:**
```javascript
// Use date parsing library
const parsedDate = parseNaturalLanguage("next Monday");
// → "2026-03-17"

const timeRange = parseTimePreference("morning");
// → { start: "09:00", end: "11:00" }
```

---

### 8. Combine Questions to Reduce Back-and-Forth

**Instead of:**
```
AI: "What's your name?"
User: "John Smith"
AI: "What's your email?"
User: "john@email.com"
AI: "What's your phone?"
User: "0400123456"
```

**Do this:**
```
AI: "I need your name, email, and phone number to create your account."
User: "John Smith, john@email.com, 0400123456"
```

**AI extracts all three at once using entity recognition.**

---

### 9. Proactive Exception Handling

**Weather Detection (Future Enhancement):**
```
// Check weather 24h before lesson
if (severeWeatherWarning && hoursBeforeLesson < 24) {
  sendProactiveMessage({
    message: "Severe weather expected for your lesson tomorrow. 
              Would you like to reschedule at no charge?",
    actions: ['reschedule', 'keep_booking']
  });
}
```

---

### 10. Confirmation Before Booking

**Always confirm key details before creating booking:**

```
AI: "Perfect! Let me confirm your booking:
    
    • Instructor: Debesay (4.9★)
    • Package: 10 hours (save $75!)
    • First lesson: Monday, March 10th at 9am
    • Pickup: Joondalup
    • Total: $675
    
    Does everything look correct?"

User: "Yes" → Proceed with booking
User: "Actually, change the time" → Go back to scheduling
```

---

## Performance Metrics to Track

### Conversation Efficiency
- Average turns to complete booking (target: <8)
- Average conversation duration (target: <3 minutes)
- Abandonment rate (target: <15%)

### User Satisfaction
- Successful bookings / total conversations (target: >60%)
- User feedback ratings (target: >4.5/5)
- Repeat usage rate (target: >30%)

### API Performance
- Average API response time (target: <1.5s)
- API error rate (target: <1%)
- Recommendation acceptance rate (target: >70% choose top 3)

### Business Metrics
- Package upsell rate (target: >80% choose package vs single)
- 10-hour package selection rate (target: >50% of packages)
- Payment completion rate (target: >85%)

---

## Common Pitfalls to Avoid

### ❌ Don't Do This:

1. **Listing all options** - "We have 15 instructors available..."
2. **Asking for password** - Backend generates it
3. **Reading full addresses** - "123 Main Street, Joondalup, Western Australia, 6027..."
4. **Strict form-filling** - "I need your name. Now your email. Now your phone..."
5. **Ignoring context** - User says "tomorrow" and AI asks "what date?"
6. **Over-explaining** - Long descriptions of how the platform works
7. **Technical jargon** - "I'll create a booking entity in our database..."
8. **Apologizing excessively** - "Sorry, sorry, my apologies..."

### ✅ Do This Instead:

1. **Top 3 only** - "I found 3 great instructors..."
2. **Auto-generate** - "I'll send your password via SMS"
3. **Confirm briefly** - "Joondalup, got it"
4. **Flexible collection** - "I need your name, email, and phone"
5. **Smart parsing** - "Tomorrow" → Parse to actual date
6. **Concise** - 2-3 sentences max per response
7. **Natural language** - "I'm creating your booking now..."
8. **Confident** - "Let me fix that for you"

---

## Ready for Production ✅

With these optimizations, your AI voice agent will:
- Feel natural and conversational
- Complete bookings efficiently (<3 minutes)
- Handle edge cases gracefully
- Maximize package upsell (>80%)
- Provide excellent user experience (>4.5/5 rating)

**Next Step:** Import `openapi.yaml` into Copilot Studio and configure with these guidelines.
