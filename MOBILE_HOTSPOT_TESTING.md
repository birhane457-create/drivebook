# Testing Mobile App with Phone Hotspot 📱

## Perfect Setup for Android Testing!

Since your computer is connected to your phone's hotspot, you're already on the same network. This is actually the easiest way to test!

## Quick Start (5 Steps)

### 1. Find Your Computer's IP
```bash
ipconfig
```

Look for the WiFi adapter connected to your phone's hotspot:
```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.43.xxx
```

Common hotspot IP patterns:
- `192.168.43.x` (Most Android phones)
- `192.168.137.x` (Some Android phones)
- Usually your computer gets `.1` or `.2`

### 2. Update capacitor.config.ts

Replace line 9 with YOUR IP:
```typescript
url: 'http://192.168.43.1:3000', // Use YOUR IP from ipconfig
```

### 3. Start Server
```bash
npm run mobile:dev
```

Server runs at `http://192.168.43.1:3000` (accessible from your phone)

### 4. Test Connection (Optional but Recommended)

Open Chrome on your phone and go to:
```
http://192.168.43.1:3000
```

If you see your website → Connection works! ✅

### 5. Build & Run App
```bash
npm run cap:sync
npm run cap:android
```

In Android Studio:
1. Select your phone from device dropdown
2. Click green "Run" button
3. App installs and runs on your phone!

## Advantages of Hotspot Testing

✅ **No WiFi needed** - Works anywhere
✅ **Direct connection** - Phone and computer on same network
✅ **Fast** - Low latency
✅ **Secure** - Private network
✅ **Easy** - No router configuration needed

## Common Issues & Solutions

### Issue: "Cannot connect to server"

**Solution 1: Check Firewall**
Windows Firewall might be blocking port 3000.

Allow port 3000:
```bash
netsh advfirewall firewall add rule name="Next.js Dev Server" dir=in action=allow protocol=TCP localport=3000
```

Or temporarily disable firewall to test:
```bash
netsh advfirewall set allprofiles state off
```

**Solution 2: Verify IP Address**
Make sure you're using the correct IP from `ipconfig`

**Solution 3: Check Server is Running**
Ensure `npm run mobile:dev` is running and shows:
```
- Network:      http://0.0.0.0:3000
```

### Issue: "App shows blank screen"

**Check these:**
1. Server is running (`npm run mobile:dev`)
2. IP in `capacitor.config.ts` matches `ipconfig`
3. You ran `npm run cap:sync` after changing config
4. Phone browser can access `http://YOUR_IP:3000`

### Issue: "Slow loading"

This is normal on first load. Subsequent loads are faster due to caching.

## Development Workflow

```bash
# Terminal 1: Keep server running
npm run mobile:dev

# Terminal 2: When you make changes
npm run cap:sync
# Then rebuild in Android Studio
```

## Hot Reload

Changes to your code will hot-reload automatically! Just save your files and the app updates.

For config changes (like `capacitor.config.ts`), you need to:
1. Run `npm run cap:sync`
2. Rebuild in Android Studio

## Testing Checklist

- [ ] Server starts successfully
- [ ] Phone browser can access server URL
- [ ] App installs on phone
- [ ] App loads and shows content
- [ ] Login/auth works
- [ ] API calls succeed
- [ ] Images load
- [ ] Navigation works

## Pro Tips

💡 **Keep server running** - No need to restart for code changes
💡 **Use Chrome DevTools** - Inspect app via `chrome://inspect` on computer
💡 **Check server logs** - See API calls and errors in terminal
💡 **Test offline** - Turn off hotspot to test offline behavior
💡 **Battery usage** - Hotspot uses battery, keep phone charged

## When Ready for Production

1. Deploy to Vercel: `vercel deploy`
2. Update `capacitor.config.ts`:
   ```typescript
   url: 'https://your-app.vercel.app',
   cleartext: false, // Use HTTPS only
   ```
3. Build release version in Android Studio
4. Sign and upload to Google Play Store

## Need Help?

**Server not accessible from phone:**
- Check firewall settings
- Verify IP address is correct
- Ensure hotspot is active

**App won't install:**
- Enable "Install via USB" on phone
- Check USB debugging is enabled
- Try different USB cable/port

**App crashes:**
- Check Android Studio logcat for errors
- Verify all dependencies installed
- Check server logs for API errors
