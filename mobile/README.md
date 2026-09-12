# DriveBook Mobile App

React Native mobile app for DriveBook driving instructor platform.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Configure Backend URL

Edit `constants/config.ts`:
```typescript
// For local development
export const API_URL = 'http://localhost:3000';

// For testing on physical device (use your computer's IP)
export const API_URL = 'http://192.168.1.100:3000';
```

### 3. Start the App

```bash
# Start Expo development server
npm start

# Or run directly on:
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### 4. Test on Physical Device

1. Install **Expo Go** app from App Store or Play Store
2. Make sure your phone and computer are on the same WiFi
3. Scan the QR code from the terminal
4. Update `API_URL` to your computer's IP address

## 📱 Features

### Current (v1.0)
- ✅ Login with existing DriveBook credentials
- ✅ API connection to backend
- ✅ Token-based authentication

### Coming Soon
- 📅 View bookings list
- 📍 Check-in with GPS location
- ✓ Check-out with duration tracking
- 📸 Photo capture for proof
- 🔔 Push notifications
- 📊 Dashboard and analytics

## 🛠️ Development

### Project Structure
```
mobile/
├── App.tsx              # Main app component
├── constants/
│   └── config.ts        # API configuration
├── services/
│   └── api.ts           # API client and endpoints
├── assets/              # Images and icons
└── package.json
```

### Adding New Features

1. **API Endpoints**: Add to `services/api.ts`
2. **Screens**: Create new components in `App.tsx` or separate files
3. **Configuration**: Update `constants/config.ts`

### Testing

```bash
# Clear cache
npm start -- --clear

# Check for issues
npx expo-doctor
```

## 📦 Building for Production

### iOS
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

## 🔧 Troubleshooting

### "Network request failed"
- Check `API_URL` in `constants/config.ts`
- Make sure backend is running
- Verify phone and computer are on same WiFi

### "Location permission denied"
- Go to phone Settings → Apps → DriveBook → Permissions
- Enable Location access

### "Cannot connect to Metro"
- Restart Expo: `npm start -- --clear`
- Check firewall settings
- Try using tunnel: `npm start -- --tunnel`

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [DriveBook API Docs](../PROJECT_DOCUMENTATION.md)

## 🆘 Support

For issues or questions:
- Check `/MOBILE_QUICKSTART.md` in parent directory
- Email: support@drivebook.com
