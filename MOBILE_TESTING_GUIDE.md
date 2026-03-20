# Mobile App Testing Guide 📱

## Before Deployment Testing

### Option 1: Android/iOS Emulator (Recommended for Quick Testing)

**Pros:** Easy, fast, no device needed
**Cons:** Can't test device-specific features (camera, GPS, etc.)

```bash
# 1. Start server
npm run mobile:dev

# 2. Open emulator
npm run cap:android  # or cap:ios
```

Emulator connects to `localhost:3000` automatically ✅

---

### Option 2: Real Device on Same WiFi

**Pros:** Test real device features, better performance testing
**Cons:** Requires USB cable and device setup

#### Step-by-Step:

**1. Find Your Computer's IP Address**
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., `192.168.1.100`)

**2. Update `capacitor.config.ts`**
```typescript
url: 'http://192.168.1.100:3000', // Use YOUR IP
```

**3. Start Server**
```bash
npm run mobile:dev
```
Server accessible at `http://192.168.1.100:3000`

**4. Sync Changes**
```bash
npm run cap:sync
```

**5. Connect Device & Run**
- Connect phone via USB
- Enable USB debugging (Android) or trust computer (iOS)
- Run from Android Studio or Xcode

**6. Test**
Phone connects to your computer's server ✅

---

### Option 3: Use ngrok (Test from Anywhere)

**Pros:** Test from any device, anywhere, share with testers
**Cons:** Requires ngrok account, slight latency

**1. Install ngrok**
```bash
npm install -g ngrok
```

**2. Start Server**
```bash
npm run mobile:dev
```

**3. Create Tunnel**
```bash
ngrok http 3000
```
You'll get a URL like: `https://abc123.ngrok.io`

**4. Update `capacitor.config.ts`**
```typescript
url: 'https://abc123.ngrok.io',
```

**5. Sync & Run**
```bash
npm run cap:sync
npm run cap:android  # or cap:ios
```

Now anyone can test your app! ✅

---

## Testing Checklist

Before deploying, test these on mobile:

### Core Functionality
- [ ] Login/Register works
- [ ] API calls succeed
- [ ] Database operations work
- [ ] Authentication persists
- [ ] Images load correctly

### Mobile-Specific
- [ ] Touch interactions work
- [ ] Keyboard appears/dismisses properly
- [ ] App works in portrait and landscape
- [ ] Back button works (Android)
- [ ] App resumes correctly after background

### Network
- [ ] Works on WiFi
- [ ] Works on cellular data (if using ngrok or deployed URL)
- [ ] Handles network errors gracefully
- [ ] Shows loading states

### Performance
- [ ] Pages load quickly
- [ ] Smooth scrolling
- [ ] No memory leaks
- [ ] Battery usage acceptable

---

## Common Issues

### "Cannot connect to server"
- Check firewall allows port 3000
- Verify phone and computer on same WiFi
- Try pinging computer IP from phone
- Check `capacitor.config.ts` has correct IP

### "API calls fail"
- Check CORS settings in Next.js
- Verify environment variables are set
- Check server logs for errors

### "App shows blank screen"
- Check server is running
- Open browser on phone to `http://YOUR_IP:3000`
- Check console logs in Xcode/Android Studio

---

## Quick Switch Between Environments

Create these scripts in `package.json`:

```json
"mobile:dev:emulator": "set CAPACITOR_SERVER_URL=http://localhost:3000 && npm run mobile:dev",
"mobile:dev:device": "set CAPACITOR_SERVER_URL=http://192.168.1.100:3000 && npm run mobile:dev",
"mobile:dev:ngrok": "set CAPACITOR_SERVER_URL=https://your-ngrok-url.ngrok.io && npm run mobile:dev"
```

Then just run:
```bash
npm run mobile:dev:emulator  # For emulator
npm run mobile:dev:device    # For real device
npm run mobile:dev:ngrok     # For ngrok
```

---

## When Ready for Production

1. Deploy Next.js to Vercel: `vercel deploy`
2. Update `capacitor.config.ts` with production URL
3. Remove `cleartext: true` for security
4. Build release version in Xcode/Android Studio
5. Submit to App Store / Play Store

---

## Pro Tips

💡 **Use emulator for rapid development** - Faster iteration
💡 **Test on real device before release** - Catch device-specific issues
💡 **Use ngrok for remote testing** - Share with team/testers
💡 **Keep server logs visible** - Easier debugging
💡 **Test on both iOS and Android** - Different behaviors
