# Remaining Fixes - Clear Action Items

## 🎯 Quick Fixes (30 minutes total)

### 1. Fix Instructor Name in Booking Confirmation ⚠️ **HIGH PRIORITY**
**File:** `routes/booking-api.js`  
**Line:** 30  
**Current Code:**
```javascript
instructorName: `Instructor ${instructorId}`,  // ❌ Placeholder
```

**Fix:**
```javascript
// Add before SMS call (around line 21)
const instructor = await db.prisma.instructor.findUnique({
  where: { id: instructorId },
  select: { name: true }
});

// Then update line 30:
instructorName: instructor?.name || 'Your instructor',
```

**Time:** 5 minutes

---

### 2. Improve Instructor API Error Handling ⚠️ **MEDIUM PRIORITY**
**File:** `routes/instructor-api.js`  
**Current Code:**
```javascript
} catch (err) {
  res.status(500).json({ error: 'Server error' });  // ❌ No logging
}
```

**Fix:**
```javascript
const logger = require('../utils/logger');

router.get('/lookup', async (req, res) => {
  const requestId = req.requestId;
  const { phone } = req.query;
  try {
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const instructor = await instructorService.findInstructorByPhone(phone);
    if (!instructor) return res.status(404).json({ error: 'Not found' });
    res.json(instructor);
  } catch (err) {
    logger.logError(err, { requestId });  // ✅ Add logging
    res.status(500).json({ error: 'Server error' });
  }
});
```

**Time:** 10 minutes

---

### 3. Move Hardcoded Values to Config ⚠️ **LOW PRIORITY**
**Files to Update:**

#### A. `utils/config.js` - Add new config values:
```javascript
module.exports = {
  // ... existing config ...
  VOICEMAIL_MAX_LENGTH: parseInt(process.env.VOICEMAIL_MAX_LENGTH || '120', 10),
  COPILOT_TIMEOUT_MS: parseInt(process.env.COPILOT_TIMEOUT_MS || '5000', 10),
  MESSAGE_RATE_LIMIT: parseInt(process.env.MESSAGE_RATE_LIMIT || '5', 10),
  MESSAGE_RATE_WINDOW_HOURS: parseInt(process.env.MESSAGE_RATE_WINDOW_HOURS || '1', 10),
};
```

#### B. `routes/voice-webhook.js` - Replace hardcoded 120:
```javascript
// Line 69 and 73, change:
twiml.record({ maxLength: 120, action: '/api/voice/voicemail' });
// To:
twiml.record({ maxLength: config.VOICEMAIL_MAX_LENGTH, action: '/api/voice/voicemail' });
```

#### C. `services/copilot-service.js` - Replace hardcoded 5000:
```javascript
// Line 6, change:
const timeout = 5000;
// To:
const timeout = config.COPILOT_TIMEOUT_MS;
```

#### D. `services/message-service.js` - Replace hardcoded 5:
```javascript
// Line 16, change:
if (entry.count >= 5) return false;
// To:
if (entry.count >= config.MESSAGE_RATE_LIMIT) return false;

// Line 11, change:
const hour = 60 * 60 * 1000;
// To:
const windowMs = config.MESSAGE_RATE_WINDOW_HOURS * 60 * 60 * 1000;
// And update line 12:
if (now - entry.windowStart > windowMs) {
```

**Time:** 15 minutes

---

## 🔧 Optional Improvements (When Scaling)

### 4. Make Logger Async (Only if experiencing performance issues)
**File:** `utils/logger.js`  
**Current:** Uses `fs.appendFileSync()` (blocks event loop)  
**When to fix:** If you see performance issues under high load  
**Time:** 1-2 hours

**Option 1 - Simple Async:**
```javascript
const fs = require('fs').promises;

async function log(level, msg, meta) {
  const entry = { timestamp: new Date().toISOString(), level, msg, meta };
  if (meta && meta.phone) meta.phone = maskPhone(meta.phone);
  if (config.NODE_ENV === 'production') {
    const file = path.resolve(process.cwd(), 'logs', `${level}.log`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, JSON.stringify(entry) + '\n');
  } else {
    console.log(JSON.stringify(entry));
  }
}
```

**Option 2 - Use Winston (Recommended for production):**
```bash
npm install winston
```

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (config.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

---

### 5. Replace In-Memory Rate Limiter (Only for multi-instance deployment)
**File:** `services/message-service.js`  
**Current:** Uses `Map` (resets on restart)  
**When to fix:** When deploying multiple instances or need persistence  
**Time:** 2-4 hours

**Option 1 - Database-based:**
```javascript
async function allowedToMessage(phone) {
  const windowMs = config.MESSAGE_RATE_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);
  
  const count = await db.prisma.message.count({
    where: {
      callerNumber: phone,
      timestamp: { gte: windowStart }
    }
  });
  
  return count < config.MESSAGE_RATE_LIMIT;
}
```

**Option 2 - Redis (Best for scale):**
```bash
npm install ioredis
```

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function allowedToMessage(phone) {
  const key = `rate_limit:${phone}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, config.MESSAGE_RATE_WINDOW_HOURS * 3600);
  }
  return count <= config.MESSAGE_RATE_LIMIT;
}
```

---

### 6. Improve Environment Variable Validation
**File:** `utils/config.js`  
**Current:** Only validates in production  
**Fix:** Add development warnings

```javascript
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  const message = `Missing required env vars: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  } else {
    console.warn(`⚠️  WARNING: ${message}`);
    console.warn('   Some features may not work correctly.');
  }
}
```

**Time:** 5 minutes

---

## 📋 Implementation Checklist

### Must Fix (Before Production)
- [ ] **Fix #1:** Instructor name in booking confirmation
- [ ] **Fix #2:** Instructor API error handling

### Should Fix (Recommended)
- [ ] **Fix #3:** Move hardcoded values to config
- [ ] **Fix #6:** Environment variable validation warnings

### Can Fix Later (When Needed)
- [ ] **Fix #4:** Make logger async (if performance issues)
- [ ] **Fix #5:** Replace in-memory rate limiter (if scaling)

---

## 🚀 Quick Implementation Guide

### Step 1: Fix Instructor Name (5 min)
1. Open `routes/booking-api.js`
2. Add instructor lookup before SMS (around line 21)
3. Update `instructorName` on line 30
4. Test: Create a booking and verify SMS shows real name

### Step 2: Fix Instructor API Errors (10 min)
1. Open `routes/instructor-api.js`
2. Add `const logger = require('../utils/logger');` at top
3. Add `const requestId = req.requestId;` in handler
4. Add `logger.logError(err, { requestId });` in catch block
5. Test: Make invalid request and check logs

### Step 3: Move Hardcoded Values (15 min)
1. Open `utils/config.js` - Add 4 new config values
2. Open `routes/voice-webhook.js` - Replace `120` with `config.VOICEMAIL_MAX_LENGTH`
3. Open `services/copilot-service.js` - Replace `5000` with `config.COPILOT_TIMEOUT_MS`
4. Open `services/message-service.js` - Replace `5` and `hour` with config values
5. Test: Verify all functionality still works

### Step 4: Environment Validation (5 min)
1. Open `utils/config.js`
2. Update validation to show warnings in development
3. Test: Remove an env var and verify warning appears

**Total Time:** ~35 minutes for all must-fix and should-fix items

---

## ✅ Testing After Fixes

After implementing fixes, test:

1. **Booking with instructor name:**
   ```bash
   curl -X POST http://localhost:3000/api/bookings \
     -H "Content-Type: application/json" \
     -d '{
       "instructorId": "test-id",
       "clientName": "John Doe",
       "clientPhone": "+61412345678",
       "date": "2050-01-01",
       "time": "09:00",
       "duration": 60
     }'
   ```
   Check logs to verify instructor name is fetched.

2. **Instructor API error:**
   ```bash
   curl http://localhost:3000/api/instructor/lookup?phone=invalid
   ```
   Check logs to verify error is logged with requestId.

3. **Config values:**
   Set environment variables and verify they're used:
   ```bash
   export VOICEMAIL_MAX_LENGTH=180
   export COPILOT_TIMEOUT_MS=10000
   npm run dev
   ```

---

## 📝 Summary

**Must Fix (15 minutes):**
1. Instructor name in booking ✅
2. Instructor API error handling ✅

**Should Fix (20 minutes):**
3. Move hardcoded values to config ✅
4. Environment variable validation ✅

**Can Fix Later:**
5. Async logger (if needed)
6. Persistent rate limiter (if scaling)

**Total Time for Must + Should Fixes: 35 minutes**

---

*Last Updated: $(date)*
