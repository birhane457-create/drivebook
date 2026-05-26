# Copilot Upload Files

These are the primary AI-related documents for DriveBook Hybrid that should be uploaded or referenced in Copilot Studio:

- `AI_PROMPT_TEMPLATE.md` - system prompt, endpoint mappings, and few-shot examples
- `ai-instructions.md` - workflow instructions for booking, reschedule, cancel, and OTP verification
- `voice-script.md` - voice prompts, alternative phrasing, and Twilio/TwiML examples
- `AI_SYSTEM.md` - architecture and AI system overview for context
- `AI_VOICE_RECEPTIONIST_GUIDE.md` - full voice receptionist platform guide and policies
- `../openapi.yaml` - OpenAPI contract for the hybrid proxy and main app AI endpoints

> Note: The hybrid voice service exposes these AI endpoints under `/api/*` and proxies them to the main DriveBook application. Upload this spec alongside the Copilot documents to keep the voice service and main app behavior aligned.

## Recommended upload order
1. `AI_PROMPT_TEMPLATE.md`
2. `voice-script.md`
3. `ai-instructions.md`
4. `AI_SYSTEM.md`
5. `AI_VOICE_RECEPTIONIST_GUIDE.md`

Note: Copilot should ideally use the first three documents as primary instruction sources, with `AI_SYSTEM.md` and `AI_VOICE_RECEPTIONIST_GUIDE.md` for additional context only.
