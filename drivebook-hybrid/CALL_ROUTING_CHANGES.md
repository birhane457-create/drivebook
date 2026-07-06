# Call Routing Changes — Dedicated vs General Line Support

**Date:** January 2025  
**Status:** Implemented

## Problem

The voice service assumed every instructor has their own dedicated Twilio number. When `findInstructorByPhone(To)` returned null (shared DriveBook number), the system fell back to a voicemail prompt and couldn't handle the call.

## Solution

Implemented dual-path call routing based on whether `To` (the dialled number) maps to a specific instructor:

### DEDICATED LINE
- **Trigger:** `findInstructorByPhone(To)` returns an instructor
- **Greeting:** "Hi, you've reached [Instructor Name]'s booking line. I'm the DriveBook assistant."
- **Context:** Instructor profile, slots, and packages pre-loaded into system prompt
- **Flow:** Caller proceeds directly to booking flow — instructor already known

### GENERAL LINE
- **Trigger:** `findInstructorByPhone(To)` returns null (shared platform number)
- **Greeting:** "Hi, thanks for calling DriveBook. I can help you find an instructor and book a lesson."
- **Context:** No instructor pre-loaded — instructorId passed as `null` to prompt builder
- **Flow:** AI asks "Do you have a preferred instructor, or would you like me to find one near you?"
  - Preferred instructor named → `GET /api/instructors/search?name=`
  - No preference → ask location → `GET /api/instructors/recommendations?location=`

## Files Changed

### 1. `routes/voice-webhook.js`
**Before:**
```js
} else {
  twiml.say('We could not find the instructor. Please leave a message after the beep.');
  twiml.record(...);
}
```

**After:**
```js
} else {
  // GENERAL LINE: shared DriveBook number
  logger.logInfo('General DriveBook line', { dialledNumber: To, requestId });
  const agentResponse = await copilotService.connectToCopilotAgent(null, { 
    callerPhone: From, 
    lineType: 'general' 
  });
  if (agentResponse && agentResponse.type === 'say') {
    twiml.say(agentResponse.text);
  } else {
    twiml.say('Hi, thanks for calling DriveBook. How can I help you today?');
  }
}
```

### 2. `services/system-prompt-builder.js`
**Before:**
```js
if (!instructorId) {
  return '[INSTRUCTOR CONTEXT]\nNo instructor context available — general DriveBook line.\n[END CONTEXT]';
}
```

**After:**
```js
if (!instructorId) {
  return `[INSTRUCTOR CONTEXT]
Line type: GENERAL — no specific instructor
The caller dialled the shared DriveBook number. You must discover the right instructor during the call.

Next steps:
1. Ask: "Do you have a preferred instructor, or would you like me to find one near you?"
2. If preferred name given: call GET /api/instructors/search?name=
3. If no preference: ask for location, then call GET /api/instructors/recommendations?location=
[END CONTEXT]`;
}
```

### 3. `prompts/modules/booking.md`
Added section at the top:

```markdown
### General line vs dedicated line flow

**DEDICATED LINE** (instructor context pre-loaded):
- Greeting already identified the instructor
- Skip instructor selection — proceed directly to location step
- Use instructorId from injected [INSTRUCTOR CONTEXT] block

**GENERAL LINE** (no instructor context):
- Greeting was: "Hi, thanks for calling DriveBook."
- Must discover instructor before location
- Ask: "Do you have a preferred instructor, or would you like me to find one near you?"
```

## No Changes Needed

- `prompts/identity.md` — already had both greeting variants
- `ai-instructions.md` — already documents both recommendation and search endpoints
- `copilot-service.js` — already accepts `null` instructorId

## Testing Checklist

- [ ] Call a dedicated instructor line → greets as that instructor → books correctly
- [ ] Call the shared DriveBook number → greets as DriveBook → asks preference → finds instructor → books correctly
- [ ] General line: caller names an instructor → search finds them → proceeds
- [ ] General line: caller has no preference → asks location → recommendations presented → proceeds
- [ ] Session recovery works on both line types

## Business Plan Payment Integration (Future)

The payment mode branching (`platform` / `instructor_direct` / `cash`) is not yet implemented. When the Business plan launches:

1. Add `paymentMode` field to instructor profile API
2. Include `paymentMode` in the `[INSTRUCTOR CONTEXT]` block
3. Branch SMS send in `main-app-proxy.js` based on `paymentMode`
4. Update `prompts/modules/booking.md` with payment mode branches

See original discussion for details.
