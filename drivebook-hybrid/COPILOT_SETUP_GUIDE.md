# DriveBook AI Receptionist  Copilot Configuration Guide

**Version:** 1.0  July 2026  
**Audience:** Developer setting up the AI agent for the first time  
**Purpose:** One clear document covering everything that needs to be configured before the AI receptionist can handle live calls.

---

## How it all connects

```
Caller phones Twilio number
        
voice-webhook.js (this service)
  - Looks up instructor by Twilio number
  - Builds system prompt (identity + rules + intent module + live context)
  - Sends POST to COPILOT_BASE_URL/agents/{instructorId}/connect
        
Your AI Copilot Agent
  - Receives the system prompt in the request body
  - Handles the conversation with the caller via Twilio
  - Calls back to this service's /api/* routes to take actions
        
main-app-proxy.js (this service)
  - Forwards AI tool calls to the main DriveBook app
  - Returns results back to the AI agent
```

The voice service builds and injects the system prompt. Your AI agent only needs to:
1. Accept the system prompt from the request body
2. Use it as the conversation instruction
3. Call the /api/* tools documented below

---

## Step 1  Environment variables

Copy `.env.example` to `.env` and fill in:

```env
# The URL of your AI agent service
COPILOT_BASE_URL="https://your-copilot-endpoint.com"

# How long to wait for the agent before timing out (milliseconds)
COPILOT_TIMEOUT_MS=5000

# The main DriveBook app URL (for API proxying)
DRIVEBOOK_BASE_URL="https://drivebook.com.au"

# Internal API key  must match VOICE_SERVICE_API_KEY in the main app .env
DRIVEBOOK_API_KEY="your-32-char-hex-key"

# Twilio credentials
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+61400000000"

# Redis for persistent sessions across restarts (optional but recommended)
REDIS_URL="rediss://default:token@host.upstash.io:6379"
```

---

## Step 2  What the agent receives on each call

When a call comes in, the voice service sends this to your agent:

```
POST {COPILOT_BASE_URL}/agents/{instructorId}/connect
Content-Type: application/json

{
  "callerPhone": "+61400123456",
  "systemPrompt": "<full assembled prompt  see Step 3>"
}
```

Your agent endpoint must:
- Accept this POST request
- Use `systemPrompt` as the LLM system message for the conversation
- Return a TwiML-compatible response OR manage the Twilio call directly

If your agent returns `{ type: "say", text: "..." }` the voice service will speak that text via Twilio.  
If it returns `{ type: "dial", number: "..." }` the voice service will transfer the call.

---

## Step 3  The system prompt (knowledge layer)

The system prompt is assembled automatically from these files every call:

```
prompts/identity.md           Who the AI is, opening greetings
prompts/business-rules.md     Rules, OTP policy, payment read-only rule
prompts/state-machine.md      8-state conversation flow
prompts/voice-rules.md        Speaking rate, pausing, handoff triggers
prompts/modules/[intent].md   Only the module matching the call intent
prompts/modules/api-errors.md  Error handling and retry rules
[INSTRUCTOR CONTEXT block]    Live instructor data fetched at call start
[SESSION MEMORY block]        Caller's previous call context (if applicable)
```

**You do not configure knowledge in the copilot platform directly.**  
Knowledge lives in the `.md` files. Edit those files to change AI behaviour.

To update a behaviour: edit the relevant `.md` file in `prompts/` and redeploy the voice service. The AI picks up the change on the next call.

---

## Step 4  Tools the agent can call

The agent calls these endpoints on this voice service (`http://this-service/api/*`).  
The voice service proxies them to the main DriveBook app.

### Read-only tools (safe to call at any time)

| Tool | Endpoint | When to use |
|------|----------|-------------|
| Validate location | `POST /api/locations/validate` | Before searching for instructors |
| Find instructors | `GET /api/instructors/recommendations?location=` | When caller has no preference |
| Search by name | `GET /api/instructors/search?name=` | When caller names an instructor |
| Check availability | `GET /api/availability/slots?instructorId=&date=&duration=` | After instructor selected |
| Get pricing | `GET /api/packages?instructorId=` | When caller asks about cost or before confirmation |
| Look up booking | `GET /api/bookings/lookup?phone=` | For cancel, reschedule, or lookup intents |
| Get booking detail | `GET /api/public/bookings/:id?phone=` | To check canCancel / canReschedule |
| Cancellation policy | `GET /api/bookings/:id/cancellation-policy` | Before cancelling  get exact refund amount |
| Payment status | `GET /api/public/bookings/:id/payment-status?token=` | When caller says "did my payment go through?" |
| Booking timeline | `GET /api/public/bookings/:id/timeline?token=` | When caller asks "what happened to my booking?" |
| Health check | `GET /api/health` | Diagnostic only |

### Write tools (require verbal confirmation first)

| Tool | Endpoint | Requires |
|------|----------|---------|
| Create booking | `POST /api/public/bookings/bulk` | Verbal "yes" from caller |
| Send OTP | `POST /api/verifications/otp` | Intent is cancel or reschedule |
| Confirm OTP | `POST /api/verifications/otp/confirm` | Caller has read back the code |
| Cancel booking | `POST /api/public/bookings/:id/cancel` | OTP confirmed + verbal "yes" |
| Reschedule booking | `POST /api/public/bookings/:id/reschedule` | OTP confirmed + verbal "yes" |

**The agent must never call write tools without verbal confirmation. This is enforced by the system prompt  but your agent platform should also not auto-confirm actions without the AI explicitly receiving a "yes".**

---

## Step 5  Configuring your specific agent platform

### Option A  OpenAI Assistants API

1. Create an Assistant with model `gpt-4o` (or `gpt-4-turbo`).
2. Set Instructions to: `You will receive the full system prompt in the user message on each call. Use it as your instruction set for that call.`
3. Add tools as **function calling definitions**  one per endpoint in Step 4.
4. Your agent endpoint (`COPILOT_BASE_URL/agents/:id/connect`) receives the POST from the voice service, starts an Assistant thread with the `systemPrompt` as the first user message, and returns responses to Twilio.
5. Set `COPILOT_TIMEOUT_MS=8000` (Assistants API can be slow on first token).

### Option B  Azure AI Foundry / Azure Copilot Studio

1. Create a Custom AI Agent (not a Power Virtual Agent bot).
2. In the agent configuration, set the System Message to a placeholder  the voice service overrides it on each call via the `systemPrompt` field.
3. Expose the agent via an HTTP endpoint that accepts the POST from Step 2.
4. Register each tool from Step 4 as an **Action** in the agent, pointing to this voice service's `/api/*` routes.
5. The agent calls those Actions during the conversation; the voice service proxies them to the main DriveBook app.

### Option C  Custom LLM endpoint (e.g. direct OpenAI API call)

If you're building your own agent endpoint:

```javascript
// Minimal copilot endpoint example
app.post('/agents/:instructorId/connect', async (req, res) => {
  const { callerPhone, systemPrompt } = req.body;
  
  // Start a conversation with your LLM using the system prompt
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Caller phone: ${callerPhone}. Begin the call.` }
    ],
    tools: driveBookTools,  // Tool definitions from Step 4
  });
  
  // Return TwiML or structured response for the voice service
  res.json({ type: 'say', text: response.choices[0].message.content });
});
```

---

## Step 6  Intent detection (optional but recommended)

The voice service passes `intent` to `buildSystemPrompt` when it knows the call intent in advance. If you detect intent from the caller's first utterance before connecting to the full agent, pass it back to reduce prompt size by ~30%.

Currently `intent` defaults to `'booking'` for all calls. To enable per-call intent detection:

1. Add a lightweight intent classifier before `connectToCopilotAgent` in `voice-webhook.js`.
2. Pass the detected intent: `copilotService.connectToCopilotAgent(instructor.id, { callerPhone: From, intent: 'cancel' })`.
3. Update `copilot-service.js` to forward `intent` to `buildSystemPrompt`.

Valid intent values: `booking | cancellation | reschedule | lookup | pricing | complaints`

---

## Step 7  Session memory (call recovery)

The voice service handles session persistence automatically. You do not configure this in the agent.

When a caller rings back within 10 minutes:
- The voice service checks `GET /api/public/bookings/:id/payment-status` (if a booking was in progress)
- If payment succeeded: caller is told their booking is confirmed  no agent needed
- If payment expired: caller is offered a fresh start  no agent needed
- If payment still pending: agent is connected with session memory injected into the prompt

The agent receives session memory as a `[SESSION MEMORY]` block at the end of the system prompt. It should resume from where the caller left off.

---

## Step 8  Verification checklist before going live

Run through this before deploying to production:

- [ ] `COPILOT_BASE_URL` points to a live, reachable agent endpoint
- [ ] `DRIVEBOOK_API_KEY` matches `VOICE_SERVICE_API_KEY` in the main app `.env`
- [ ] `TWILIO_AUTH_TOKEN` is the live token (not test credentials)
- [ ] `SKIP_TWILIO_VALIDATION=false` in production `.env`
- [ ] `REDIS_URL` is set for persistent sessions (recommended for production)
- [ ] Agent endpoint accepts POST `{ callerPhone, systemPrompt }` and returns a valid response
- [ ] All tools from Step 4 are registered in the agent platform
- [ ] Test call: book  pay  cancel cycle works end to end
- [ ] Test call: caller hangs up mid-OTP  calls back  recovery prompt appears
- [ ] Test call: caller pays  calls back  "your booking is confirmed" response

---

## Step 9  Adding or changing AI behaviour

| What you want to change | Where to edit |
|------------------------|---------------|
| Opening greeting | `prompts/identity.md` |
| Business rules (what AI must/never do) | `prompts/business-rules.md` |
| Conversation flow (state machine) | `prompts/state-machine.md` |
| Speaking style / voice pacing | `prompts/voice-rules.md` |
| Booking flow | `prompts/modules/booking.md` |
| Cancel flow | `prompts/modules/cancellation.md` |
| Reschedule flow | `prompts/modules/reschedule.md` |
| Existing booking lookup | `prompts/modules/lookup.md` |
| Pricing queries | `prompts/modules/pricing.md` |
| Complaints / escalation | `prompts/modules/complaints.md` |
| Error handling | `prompts/modules/api-errors.md` |
| Add a new scenario | Add to the appropriate module file |
| Change what API data is injected | `services/system-prompt-builder.js` |
| Change session recovery behaviour | `services/voice-session-service.js` + `routes/voice-webhook.js` |

After editing any `.md` file: redeploy the voice service. No agent reconfiguration needed.

---

## Reference  File locations

```
drivebook-hybrid/
 .env                           your environment config (copy from .env.example)
 prompts/
    identity.md                WHO the AI is
    business-rules.md          WHAT it must/never do
    state-machine.md           HOW it flows through a call
    voice-rules.md             HOW it speaks
    modules/
        booking.md             new booking flow
        cancellation.md        cancel flow
        reschedule.md          reschedule flow
        lookup.md              existing booking queries + payment check
        pricing.md             pricing inquiries
        complaints.md          complaints + escalation
        api-errors.md          error handling + retry rules
 services/
    system-prompt-builder.js   assembles the system prompt per call
    voice-session-service.js   manages call-back recovery state
    copilot-service.js         sends the prompt + caller data to your agent
 routes/
    voice-webhook.js           handles incoming Twilio calls
    main-app-proxy.js          proxies API tool calls to DriveBook app
 voice-scenarios.md             DEVELOPER REFERENCE (not injected at runtime)
 OPENAPI_GAP_REMEDIATION.md     history of API gap fixes
```

---

*For questions about the DriveBook API contract, refer to `openapi.yaml` and `openapi-management.yaml` in the root of the drivebook repository.*