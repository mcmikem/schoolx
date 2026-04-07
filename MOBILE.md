# 📱 SkoolMate OS Mobile App

## Quick Start

### 1. Build the web app first
```bash
npm run build
```

### 2. Sync with native platforms
```bash
npx cap sync
```

### 3. Open in Android Studio (Android)
```bash
npx cap open android
```
Then click **Run** (▶️) in Android Studio to build and launch on emulator/device.

### 4. Open in Xcode (iOS)
```bash
npx cap open ios
```
Then select a simulator/device and click **Run** (▶️).

---

## Development Mode (Live Reload)

1. Start Next.js dev server:
   ```bash
   npm run dev
   ```

2. Find your local IP:
   ```bash
   # On macOS
   ipconfig getifaddr en0
   ```

3. Update `capacitor.config.ts`:
   ```ts
   server: {
     url: 'http://YOUR_LOCAL_IP:3000',
     cleartext: true,
   }
   ```

4. Run on device:
   ```bash
   npx cap run android --livereload --external
   # or
   npx cap run ios --livereload --external
   ```

---

## App Features

| Feature | Status |
|---------|--------|
| Push Notifications | ✅ Configured (Firebase) |
| Splash Screen | ✅ Navy #001F3F |
| Status Bar | ✅ Dark style |
| Haptic Feedback | ✅ On button taps |
| Back Button | ✅ Android navigation |
| Deep Links | ✅ `skoolmate://open` |
| Camera | ✅ Permission added |
| Photo Library | ✅ Permission added |

---

## Build for Release

### Android (APK/AAB)
```bash
npm run build:android
npx cap open android
```
In Android Studio: **Build → Generate Signed Bundle/APK**

### iOS (.ipa)
```bash
npm run build:ios
npx cap open ios
```
In Xcode: **Product → Archive** → Distribute to App Store

---

## Generate App Icons
```bash
# Install ImageMagick first: brew install imagemagick
chmod +x scripts/generate-icons.sh
./scripts/generate-icons.sh
npx cap sync
```

---

## Push Notifications

Already configured with your Firebase VAPID key. The app will:
1. Request permission on first launch
2. Register with FCM/APNS
3. Save token to `push_subscriptions` table
4. Show notifications for: fees, grades, attendance, messages