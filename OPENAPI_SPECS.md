# DriveBook OpenAPI Specifications

We provide 3 focused OpenAPI specs instead of one large spec to avoid the 1000 character description limit for custom connectors.

## Which Spec to Use?

### 1. openapi-core.yaml (PRIMARY - Use This First)
**For: AI Voice Agents - Main Booking Flow**

**Endpoints:**
- `/health` - Health check
- `/locations/validate` - Validate pickup location
- `/instructors/recommendations` - Get top 3 instructors (PRIMARY)
- `/instructors/search` - Search all instructors (FALLBACK)
- `/packages` - Get lesson packages with pricing
- `/availability/slots` - Check available time slots
- `/public/bookings/bulk` - Create booking (PENDING_PAYMENT)

**Use this for:**
- Initial booking conversations
- Location validation
- Instructor discovery
- Package presentation
- Creating new bookings

**Description Length:** 850 characters ✅

---

### 2. openapi-management.yaml (SECONDARY)
**For: AI Voice Agents - Managing Existing Bookings**

**Endpoints:**
- `/bookings/lookup` - Find bookings by phone number
- `/bookings/{id}/cancellation-policy` - Check cancellation fees
- `/bookings/{id}/cancel` - Cancel booking with refund
- `/bookings/{id}/reschedule` - Reschedule to new date/time
- `/instructors/lookup` - Find instructor by name/phone (optional)

**Use this for:**
- "I need to cancel my lesson"
- "I want to reschedule"
- "What's my booking?"
- Follow-up conversations

**Description Length:** 350 characters ✅

---

### 3. openapi-webhooks.yaml (BACKEND ONLY)
**For: Backend Integrations - NOT for AI Agents**

**Endpoints:**
- `/webhooks/stripe` - Stripe payment confirmation
- `/webhooks/stripe/test` - Test webhook (development)

**Use this for:**
- Backend webhook configuration
- Stripe integration setup
- Payment confirmation flow
- NOT called by AI agents

**Description Length:** 450 characters ✅

---

## Import Order for AI Agents

### Copilot Studio / Power Platform

1. **Import Core API First:**
   - File: `openapi-core.yaml`
   - This gives AI the main booking flow
   - Most conversations will use only this

2. **Import Management API (Optional):**
   - File: `openapi-management.yaml`
   - Add this if you want cancellation/rescheduling
   - Can be added later

3. **Skip Webhooks API:**
   - File: `openapi-webhooks.yaml`
   - This is for backend only
   - AI agents don't call webhooks

### Other Platforms

If your platform supports larger descriptions, you can use:
- `openapi.yaml` - Complete spec with shortened description (under 1000 chars)

---

## Conversation Flow Examples

### Using Core API Only

```
User: "I need driving lessons"
AI: Calls /locations/validate
AI: Calls /instructors/recommendations
AI: Calls /availability/slots
AI: Calls /packages
AI: Calls /public/bookings/bulk
AI: "Payment link sent to your phone!"
```

### Using Core + Management APIs

```
User: "I need to cancel my lesson"
AI: Calls /bookings/lookup (Management API)
AI: Calls /bookings/{id}/cancellation-policy (Management API)
AI: "Cancelling will result in 50% refund. Proceed?"
User: "Yes"
AI: Calls /bookings/{id}/cancel (Management API)
AI: "Done! $42.50 refunded to your wallet."
```

---

## Rate Limits

All specs include rate limiting documentation:

**Core API:**
- Recommendations: 30/min per IP
- Search: 60/min per IP
- Location validation: 20/min per IP
- Booking creation: 10/min per phone

**Management API:**
- Cancellation: 3/hour per booking
- Rescheduling: 3/hour per booking

**Webhooks API:**
- No limit (signature validation only)

---

## Security Notes

### Payment Security (CRITICAL)

All specs document that **AI NEVER handles payment data**:

❌ AI does NOT collect credit card numbers
❌ AI does NOT process payments
❌ AI does NOT ask for CVV codes

✅ AI creates PENDING_PAYMENT booking
✅ Backend sends Stripe Checkout link via SMS
✅ User pays securely on Stripe
✅ Webhook confirms payment → CONFIRMED

### Why This Matters

- **PCI DSS Compliance:** Voice channels aren't secure for payment data
- **User Trust:** People uncomfortable giving card details verbally
- **Audit Trail:** Written confirmation for disputes
- **Fraud Prevention:** Voice can be recorded/spoofed

---

## Testing

### Development

1. **Core API:**
   ```bash
   # Test location validation
   curl -X POST https://drivebook.com.au/api/locations/validate \
     -H "Content-Type: application/json" \
     -d '{"pickupLocation": "Joondalup WA"}'
   
   # Test recommendations
   curl "https://drivebook.com.au/api/instructors/recommendations?location=Joondalup%20WA&limit=3"
   ```

2. **Management API:**
   ```bash
   # Test booking lookup
   curl "https://drivebook.com.au/api/bookings/lookup?phone=0400123456"
   
   # Test cancellation policy
   curl "https://drivebook.com.au/api/bookings/bk_123/cancellation-policy"
   ```

3. **Webhooks API:**
   ```bash
   # Test with Stripe CLI
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   
   # Or use test endpoint
   curl -X POST https://drivebook.com.au/api/webhooks/stripe/test \
     -H "X-Test-Secret: your-test-secret" \
     -H "Content-Type: application/json" \
     -d '{"bookingId": "bk_123"}'
   ```

---

## Maintenance

### Updating Specs

When adding new endpoints:

1. **Booking-related?** → Add to `openapi-core.yaml`
2. **Management-related?** → Add to `openapi-management.yaml`
3. **Webhook-related?** → Add to `openapi-webhooks.yaml`
4. **Update all?** → Update `openapi.yaml` too (for backward compatibility)

### Keep Descriptions Short

- Core API: Max 900 chars (leave 100 char buffer)
- Management API: Max 900 chars
- Webhooks API: Max 900 chars

If description gets too long, split into another spec.

---

## Summary

✅ **Use openapi-core.yaml for AI voice agents** (primary booking flow)
✅ **Use openapi-management.yaml for follow-up actions** (cancel/reschedule)
✅ **Use openapi-webhooks.yaml for backend only** (Stripe integration)
✅ **All specs under 1000 char limit** (custom connector compatible)
✅ **Better organization** (easier to maintain)
✅ **Security documented** (AI never handles payment)

**Start with Core API, add Management API later if needed.**
