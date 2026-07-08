# _copilot-archive

Archived during migration from Microsoft Copilot Studio to Vapi (July 2026).

These files are NOT loaded by the running service. They are kept here temporarily
in case anything needs to be referenced during the Vapi migration.

Safe to delete once the Vapi integration is fully tested and stable.

## Contents

| File | What it did |
|---|---|
| routes/voice-webhook.js | Twilio webhook handler  routed incoming calls to Copilot Studio via Direct Line |
| services/copilot-service.js | Direct Line API client  started conversations, polled for bot responses |
| services/system-prompt-builder.js | Built runtime system prompts from the prompt layer files below |
| services/message-service.js | Stored voicemail transcripts and rate-limited messages (voicemail dead with Vapi migration) |
| services/twilio-service.js | Helper to build TwiML VoiceResponse objects (only used by voice-webhook.js) |
| services/drivebook-api-client.js | Typed HTTP client for the main app (superseded by main-app-proxy.js direct axios calls) |
| prompts/identity.md | Bot persona layer |
| prompts/business-rules.md | Business logic layer |
| prompts/state-machine.md | Call flow state machine |
| prompts/voice-rules.md | Voice interaction rules |
| prompts/modules/*.md | Per-intent modules (booking, cancellation, reschedule, lookup, pricing, complaints, api-errors) |
| voice-scenarios.md | Copilot conversation design doc |

## What replaced them

- Vapi owns the call and runs the AI  no Twilio webhook needed
- System prompt lives in Vapi dashboard (seeded by create-vapi-assistant.js at repo root)
- Vapi calls the hybrid service API routes directly as tool calls