@echo off
echo Installing Capacitor and dependencies...
echo.

echo Step 1: Installing Capacitor Core
call npm install @capacitor/core @capacitor/cli

echo.
echo Step 2: Installing Native Platforms
call npm install @capacitor/ios @capacitor/android

echo.
echo Step 3: Installing Native Plugins
call npm install @capacitor/push-notifications
call npm install @capacitor/geolocation
call npm install @capacitor/camera
call npm install @capacitor/local-notifications
call npm install @capacitor/haptics
call npm install @capacitor/splash-screen

echo.
echo Step 4: Initializing Capacitor
echo Please answer the following prompts:
echo - App name: DriveBook
echo - App ID: com.drivebook.app
echo - Web asset directory: out
echo.
call npx cap init

echo.
echo Step 5: Adding Native Platforms
call npx cap add android

echo.
echo ✅ Capacitor installation complete!
echo.
echo Next steps:
echo 1. Build your app: npm run mobile:build
echo 2. Open Android Studio: npm run cap:android
echo 3. For iOS (macOS only): npx cap add ios
echo.
pause
