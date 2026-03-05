# Third-Party Integrations

DriveBook integrates with several external services to provide a complete driving school management platform.

## Overview

| Integration | Purpose | Status | Documentation |
|------------|---------|--------|---------------|
| Stripe | Payment processing, subscriptions | ✅ Active | [STRIPE_PAYMENTS.md](./STRIPE_PAYMENTS.md) |
| Twilio | SMS notifications, voice calls | ✅ Active | [SMS_NOTIFICATIONS.md](./SMS_NOTIFICATIONS.md) |
| Microsoft Copilot | AI voice receptionist | ✅ Active | [AI_VOICE_RECEPTIONIST.md](./AI_VOICE_RECEPTIONIST.md) |
| Google Calendar | Instructor calendar sync | ✅ Active | [GOOGLE_CALENDAR.md](./GOOGLE_CALENDAR.md) |
| Google OAuth | Sign in with Google | ✅ Active | [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md) |
| Google Maps | Location services | ✅ Active | Built-in |

## Quick Start

### Required Integrations

These are essential for the platform to function:

1. **Stripe** - Payment processing
   - Required for: Wallet top-ups, package purchases, instructor payouts
   - Setup time: 30 minutes
   - [Setup Guide](./STRIPE_PAYMENTS.md)

2. **Twilio SMS** - Notifications
   - Required for: Check-in/check-out, booking confirmations
   - Setup time: 15 minutes
   - [Setup Guide](./SMS_NOTIFICATIONS.md)

### Optional Integrations

These enhance functionality but aren't required:

3. **AI Voice Receptionist** - Phone bookings
   - Enables: Clients can book lessons by phone
   - Setup time: 1-2 hours
   - [Setup Guide](./AI_VOICE_RECEPTIONIST.md)

4. **Google Calendar** - Calendar sync
   - Enables: Two-way sync with instructor calendars
   - Setup time: 30 minutes
   - [Setup Guide](./GOOGLE_CALENDAR.md)

5. **Google OAuth** - Social login
   - Enables: Sign in with Google
   - Setup time: 20 minutes
   - [Setup Guide](./GOOGLE_OAUTH.md)

## Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DriveBook Platform                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Web App    │  │  Mobile App  │  │  Admin Panel │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┴─────────────────┘           │
│                          │                              │
│                    ┌─────▼─────┐                        │
│                    │  API Layer │                       │
│                    └─────┬─────┘                        │
└──────────────────────────┼──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌─────▼─────┐     ┌─────▼─────┐
   │ Stripe  │       │  Twilio   │     │  Google   │
   │         │       │           │     │           │
   │ Payments│       │ SMS/Voice │     │ OAuth/Cal │
   └─────────┘       └───────────┘     └───────────┘
                           │
                     ┌─────▼─────┐
                     │ Copilot   │
                     │ AI Agent  │
                     └───────────┘
```

## Environment Variables

All integrations are configured via environment variables in `.env`:

```bash
# Stripe
STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1234567890"

# Google
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="..."

# NextAuth (for OAuth)
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="..."
```

See `.env.example` for complete configuration.

## Security Considerations

### API Keys
- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate keys regularly (quarterly recommended)
- Use test keys in development

### Webhooks
- Always validate webhook signatures
- Use HTTPS in production
- Implement replay attack prevention
- Log all webhook events

### OAuth
- Use state parameter to prevent CSRF
- Validate redirect URIs
- Store tokens securely (encrypted)
- Implement token refresh logic

## Testing Integrations

### Development Mode

Most integrations have test/sandbox modes:

- **Stripe**: Use test keys (`pk_test_...`, `sk_test_...`)
- **Twilio**: Use test credentials and verified numbers
- **Google**: Use localhost redirect URIs

### Testing Checklist

- [ ] Stripe payment flow (test card: 4242 4242 4242 4242)
- [ ] Twilio SMS delivery (to verified number)
- [ ] Google OAuth login flow
- [ ] Calendar sync (create/update/delete events)
- [ ] Voice receptionist call flow
- [ ] Webhook signature validation
- [ ] Error handling and retries

## Monitoring

### Key Metrics

Track these metrics for each integration:

- **Stripe**: Transaction success rate, failed payments, payout timing
- **Twilio**: SMS delivery rate, call completion rate, costs
- **Google**: OAuth success rate, calendar sync errors
- **Copilot**: Call handling rate, booking conversion

### Alerts

Set up alerts for:
- Payment processing failures (>1%)
- SMS delivery failures (>5%)
- OAuth errors (>2%)
- API rate limit warnings
- Webhook signature failures

## Cost Management

### Estimated Monthly Costs

Based on 100 active instructors, 500 bookings/month:

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| Stripe | 500 transactions | $145 (2.9% + $0.30) |
| Twilio SMS | 2000 messages | $20 ($0.01/msg) |
| Twilio Voice | 50 calls, 5 min avg | $15 ($0.06/min) |
| Google Maps | 10k requests | $50 |
| Google Calendar | Free | $0 |
| Copilot Studio | 100 conversations | $50-100 |
| **Total** | | **~$280-330/month** |

### Cost Optimization

- Use SMS sparingly (only critical notifications)
- Cache Google Maps results
- Batch calendar updates
- Monitor Copilot conversation length
- Use Stripe's optimized pricing for volume

## Troubleshooting

### Common Issues

**"Stripe webhook signature invalid"**
- Verify `STRIPE_WEBHOOK_SECRET` matches dashboard
- Check webhook endpoint URL is correct
- Ensure raw body is used for validation

**"Twilio SMS not delivered"**
- Verify phone number format (+country code)
- Check Twilio account balance
- Verify sender number is approved
- Check recipient number isn't blocked

**"Google OAuth error"**
- Verify redirect URI matches exactly
- Check OAuth consent screen is configured
- Ensure scopes are approved
- Verify client ID/secret are correct

**"Calendar sync failing"**
- Check OAuth token hasn't expired
- Verify calendar permissions granted
- Ensure calendar ID is correct
- Check for API quota limits

## Support Resources

- **Stripe**: https://stripe.com/docs
- **Twilio**: https://www.twilio.com/docs
- **Google Cloud**: https://cloud.google.com/docs
- **Microsoft Copilot**: https://docs.microsoft.com/copilot-studio

## Related Documentation

- [Database Schema](../01-architecture/DATABASE_SCHEMA.md)
- [API Structure](../01-architecture/API_STRUCTURE.md)
- [Financial Ledger](../02-finance/LEDGER_RULES.md)
- [Admin Manual](../03-operations/ADMIN_MANUAL.md)

---

**Last Updated**: March 4, 2026  
**Maintained By**: DriveBook Engineering Team
