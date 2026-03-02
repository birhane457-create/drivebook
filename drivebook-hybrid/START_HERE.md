# 🚀 START HERE - Mobile App Setup

## You're Almost There!

The mobile app is ready. Just need 5 minutes to configure and test.

## Step 1: Find Your IP Address

Run this command:
```bash
npm run show:ip
```

You'll see something like:
```
✅ Wi-Fi: 192.168.118.108
```

Copy the Wi-Fi IP address (e.g., `192.168.118.108`)

## Step 2: Update Mobile Config

1. Open: `mobile/constants/config.ts`

2. Change this line:
```typescript
export const API_URL = 'http://10.0.2.2:3000';
```

To this (use YOUR IP from Step 1):
```typescript
export const API_URL = 'http://192.168.118.108:3000';
```

3. Save the file

## Step 3: Start Everything

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Mobile App:**
```bash
cd mobile
npm start
```

## Step 4: Test on Phone

1. Install "Expo Go" app from App Store or Play Store
2. Make sure phone is on same WiFi as computer
3. Scan the QR code from Terminal 2
4. Login with: debesay304@gmail.com

## ✅ Success!

You should see "✅ Logged In!" on your phone.

## 🐛 Problems?

- **Network failed**: Check IP address is correct
- **Can't connect**: Disable Windows Firewall
- **Wrong credentials**: Try web login first

## 📚 More Help

- `MOBILE_NEXT_STEPS.md` - Detailed instructions
- `MOBILE_CHECKLIST.md` - Step-by-step checklist
- `MOBILE_LOGIN_TROUBLESHOOTING.md` - Fix errors

## 🎯 After It Works

Let me know login works, then I'll build:
- Bookings list
- Check-in/out with GPS
- Camera for photos
- Push notifications
