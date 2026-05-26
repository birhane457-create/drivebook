# DriveBook Voice Script

## Overview
This voice script is designed for the AI receptionist to handle driving lesson booking, reschedule, and cancel flows with identity verification.
It includes alternative phrasings and Twilio/TwiML timing recommendations.

---

## 1. Greeting and intent capture

### Primary prompt
- "Welcome to DriveBook. I can help you book, reschedule, or cancel a lesson. What would you like to do today?"

### Alternative phrasings
- "Hi, you're through to DriveBook Voice. Tell me if you want to book a lesson, change an existing one, or cancel a booking."
- "Hello. I can help with new bookings, changing lesson times, or cancellations. How can I help?"

### TwiML example
```xml
<Response>
  <Gather input="speech dtmf" timeout="5" numDigits="1" action="/voice/intent" method="POST">
    <Say voice="alice" language="en-AU">
      Welcome to DriveBook. I can help you book a lesson, reschedule or cancel.
      Please say booking, reschedule, or cancel.
    </Say>
  </Gather>
  <Say voice="alice">I didn't catch that. Please say booking, reschedule, or cancel.</Say>
</Response>
```

### Timing notes
- Use `timeout="5"` or `6` to allow the user time to speak.
- Add a short pause before repeating or moving on: `<Pause length="1"/>`.

---

## 2. New booking flow

### Step 1: Pickup location

Primary prompt:
- "What's your pickup suburb or address?"

Alternative phrasing:
- "Where would you like the lesson to start from?"
- "Tell me the pickup location, such as your suburb, street name, or postcode."

TwiML snippet:
```xml
<Response>
  <Gather input="speech" timeout="6" action="/voice/pickup-location" method="POST">
    <Say voice="alice">What's the pickup suburb or address?</Say>
  </Gather>
  <Say voice="alice">Please say your pickup location again when you're ready.</Say>
</Response>
```

### Step 2: Present recommendations

Primary prompt:
- "I found 3 great instructors: Debesay top rated, Michael best value, and Sarah closest. Which one would you like?"

Alternative phrasing:
- "Here are your top choices: Debesay, Michael and Sarah. Say the name or the number."
- "I recommend Debesay for ratings, Michael for value, and Sarah for proximity. Who should I book with?"

TwiML snippet:
```xml
<Response>
  <Gather input="speech dtmf" timeout="5" action="/voice/select-instructor" method="POST">
    <Say voice="alice">
      I found three instructors: 1. Debesay, 2. Michael, and 3. Sarah.
      Say the number or the name of your preferred instructor.
    </Say>
  </Gather>
  <Say voice="alice">Please say the instructor name or number.</Say>
</Response>
```

### Step 3: Date/time window

Primary prompt:
- "Do you prefer morning, afternoon, or evening?"

Alternative phrasing:
- "When would you like your lesson? Morning, afternoon, or evening?"
- "Say morning, afternoon, or evening so I can find the best time slots."

### Step 4: Confirm slot and package

Primary prompt:
- "I have available times at 9am, 12pm and 4pm. Which one works for you?"

Alternative phrasing:
- "Choose a slot: 9am, noon, or 4pm."
- "Would you like 9 in the morning, midday, or later at 4?"

### Step 5: Contact and verification

Primary prompt:
- "What phone number or email can I use to confirm your booking?"

Alternative phrasing:
- "Please tell me the best phone or email for confirmation."
- "I need a phone number or email so I can send your booking details."

Verification prompt:
- "I will send a verification code now. Tell me the code when you get it."

Alternative phrasing:
- "A 4-digit code will be sent to your contact. Please say it back to me."
- "Please read the confirmation code when it arrives."

TwiML OTP request example:
```xml
<Response>
  <Say voice="alice">I'm sending a verification code now. Listen for it and tell me the digits.</Say>
  <Pause length="1"/>
</Response>
```

TwiML OTP collect example:
```xml
<Response>
  <Gather input="dtmf" numDigits="4" timeout="10" action="/voice/otp-confirm" method="POST">
    <Say voice="alice">Enter the 4-digit code you received.</Say>
  </Gather>
  <Say voice="alice">I didn't hear the code. Please type it using your phone keypad.</Say>
</Response>
```

### Booking confirmation

Primary prompt:
- "Your booking is confirmed with Debesay at 9am on Tuesday. You'll receive confirmation by SMS/email."

Alternative phrasing:
- "Booked successfully. A confirmation message is on its way."
- "All done. Your lesson is scheduled, and details will arrive shortly."

---

## 3. Reschedule flow

### Step 1: Ask for identifying info

Primary prompt:
- "Please tell me the phone number, email, or booking reference for the lesson you want to change."

Alternative phrasing:
- "Give me the phone, email or reference on the booking you want to reschedule."
- "What contact or booking ID is on the reservation?"

### Step 2: Present matching bookings

Prompt:
- "I found a booking for Debesay on 25 March at 9am. Is this the one?"

Alternative phrasing:
- "I found a booking on 25 March with Debesay at 9am. Should I change that one?"
- "Does that match your booking?"

### Step 3: Send OTP and confirm

Prompt:
- "I will send a verification code to the phone/email on that booking. Please tell me the code when you receive it."

Alternative phrasing:
- "A one-time code is on its way. Say it back when you have it."

If the user does not receive it:
- "If you don't get the code, I can resend it in 60 seconds."

### Step 4: Ask for new schedule

Prompt:
- "What new date and time would you like for that lesson?"

Alternative phrasing:
- "Tell me the new day and time, or say morning, afternoon, or evening."

TwiML new time gather:
```xml
<Response>
  <Gather input="speech" timeout="6" action="/voice/reschedule-details" method="POST">
    <Say voice="alice">What day and time would you like to reschedule this lesson to?</Say>
  </Gather>
  <Say voice="alice">Please say the new date and time when you are ready.</Say>
</Response>
```

### Step 5: Confirm reschedule

Prompt:
- "Your lesson has been moved to Wednesday at 2pm. I'll send an updated confirmation."

Alternative phrasing:
- "Reschedule complete. You will get the new details shortly."
- "The booking is updated. Expect a confirmation message now."

---

## 4. Cancel flow

### Step 1: Ask for booking info

Prompt:
- "To cancel, please tell me the phone number, email, or booking reference on the reservation."

Alternative phrasing:
- "Give me the booking contact or reference so I can find your lesson."
- "I need the booking phone, email, or reference number."

### Step 2: Verify and confirm cancellation

Prompt:
- "I'll send a verification code to that contact. Tell me the code when you get it."

Alternative phrasing:
- "A security code is being sent now. Please say it back to confirm the cancellation."

### Step 3: Cancel confirmation

Prompt:
- "Your booking has been cancelled. I'll send a final confirmation by SMS or email."

Alternative phrasing:
- "Cancellation is complete. You'll receive a notification shortly."
- "The booking is now cancelled. Expect confirmation in your messages."

---

## 5. Verification and fallback messaging

### OTP timing message
- "The code expires in 5 minutes."
- "This code is valid for five minutes."

### Resend delay message
- "If you need it again, I can resend after 60 seconds."
- "I can send another code in one minute."

### Rate-limit / lockout message
- "You can only request three codes per hour for this number or email."
- "Try again in a few minutes if the code request is blocked."
- "After three failed attempts, the verification will be locked temporarily."

### No contact fallback
- "If you do not have a phone or email here, I can hold a tentative booking and call you later to confirm."
- "I can place a provisional booking and contact you once we have a valid number or email."

---

## 6. TwiML timing recommendations
- Use `<Pause length="1"/>` after long messages or before asking for user input again.
- Use `<Gather timeout="5" input="speech dtmf"/>` when asking for a short phrase or choice.
- Use `<Gather numDigits="4" timeout="10" input="dtmf"/>` for PIN collection.
- After a failed gather, repeat the prompt once and then optionally route to human support.

Example fallback TwiML:
```xml
<Response>
  <Gather input="speech dtmf" timeout="5" action="/voice/confirm-intent" method="POST">
    <Say voice="alice">I didn't catch that. Please say booking, reschedule, or cancel.</Say>
  </Gather>
  <Say voice="alice">I still couldn't understand. I'll transfer you to a human assistant now.</Say>
</Response>
```

---

## 7. Best practice notes
- Keep messages short and clear in a voice call.
- Always repeat the user's choice back: "So you want to cancel the booking for Tuesday, correct?"
- When verifying identity, mention the delivery method explicitly: "I sent the code to your mobile number ending in 1234." 
- Use the verification token only after successful OTP confirmation.
- If a user is unsure, give them a choice: "I can either search by pickup location or by booking reference." 
