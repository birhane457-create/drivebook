# Start Testing - Quick Guide

## Step-by-Step Instructions

### Step 1: Start Main Platform

Open a NEW terminal window (Terminal 1):

```bash
cd E:\DOC\AI voice assistance\drivebook
npm run dev
```

**Wait for this message:**
```
✓ Ready on http://localhost:3000
```

**Keep this terminal open!**

---

### Step 2: Start Voice Service

Open ANOTHER NEW terminal window (Terminal 2):

```bash
cd "E:\DOC\AI voice assistance\drivebook\drivebook-hybrid"
npm run dev
```

**Wait for this message:**
```
Server running on port 3001
```

**Keep this terminal open!**

---

### Step 3: Run Integration Tests

Open a THIRD terminal window (Terminal 3):

```bash
cd E:\DOC\AI voice assistance\drivebook
node test-voice-integration.js
```

**Expected output:**
```
✅ Main Platform Health - SUCCESS
✅ Voice Service Health - SUCCESS
✅ Instructor Lookup - SUCCESS
```

---

## Quick Verification

If you want to quickly check if services are running:

**Check Main Platform:**
```bash
curl http://localhost:3000/api/health
```

**Check Voice Service:**
```bash
curl http://localhost:3001/api/health
```

Both should return JSON with `"status": "ok"`

---

## Troubleshooting

### "Port already in use"
```bash
# Find what's using the port
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Kill the process
taskkill /PID <PID_NUMBER> /F
```

### "Cannot find module"
```bash
# Install dependencies
cd drivebook
npm install

cd drivebook-hybrid
npm install
```

### Services won't start
- Make sure you're in the correct directory
- Check .env files exist
- Verify MongoDB connection string is correct

---

## What You Should See

### Terminal 1 (Main Platform)
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000

✓ Ready in 3.2s
```

### Terminal 2 (Voice Service)
```
Server running on port 3001
Registered routes: /api/voice, /api/bookings, /api/health
```

### Terminal 3 (Tests)
```
🧪 Voice Service Integration Test

✅ Main Platform Health - SUCCESS
✅ Voice Service Health - SUCCESS
✅ Instructor Lookup - SUCCESS

Tests Passed: 3/3
✅ All tests passed!
```

---

## Next Steps After Tests Pass

1. Test instructor lookup manually
2. Test booking creation
3. Set up ngrok for Twilio testing
4. Test voice call flow

Ready to start? Open those terminals! 🚀
