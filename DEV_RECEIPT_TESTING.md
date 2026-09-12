# Dev Receipt Testing Guide

Integration complete. Files created:
1. .env with USE_NEW_RECEIPTS=true
2. lib/services/receipt-bridge.ts
3. Updated app/api/client/wallet-add/route.ts

To test:
1. Restart dev server (npm run dev)
2. Login to http://localhost:3000
3. Go to wallet top-up
4. Add \ using Stripe test card: 4242 4242 4242 4242
5. Check email for new receipt format

Toggle systems:
- USE_NEW_RECEIPTS=true for new
- USE_NEW_RECEIPTS=false for old

Ready for testing!
