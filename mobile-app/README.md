# Song Notations - Mobile App

A React Native (Expo) Android app for practicing Indian classical music with your songbook.

## Features

1. **Songbook** — Full access to [songnotations.vercel.app](https://songnotations.vercel.app/) via WebView with native back button support
2. **Metronome** — Adjustable BPM (30-240), tap tempo, multiple time signatures (4/4, 3/4, 6/8, 7/8), beat visualization
3. **Flute Tuner** — Real-time pitch detection showing Sargam notation (Sa, Re, Ga...) with cents deviation meter
4. **Tanpura** — Continuous drone with selectable tuning (Pa/Ma/Ni), adjustable pitch (C3-C4), volume and tempo control

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Android Studio (for emulator) or Expo Go app on your phone

### Installation

```bash
cd mobile-app
npm install
```

### Generate Audio Assets

```bash
node scripts/generate-sounds.js
```

This creates placeholder sine-wave sounds. For production quality, replace files in `assets/sounds/` with real instrument samples.

### Run Development

```bash
# Start Expo dev server
npx expo start

# Run on Android emulator
npx expo run:android

# Or scan QR code with Expo Go app on your phone
```

### Build APK for Distribution

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure build
eas build:configure

# Build Android APK
eas build --platform android --profile preview

# Build production AAB for Play Store
eas build --platform android --profile production
```

## Project Structure

```
mobile-app/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout (Stack)
│   └── (tabs)/             # Tab-based navigation
│       ├── _layout.tsx     # Tab bar configuration
│       ├── index.tsx       # Songbook (WebView)
│       ├── metronome.tsx   # Metronome tool
│       ├── tuner.tsx       # Flute Tuner
│       └── tanpura.tsx     # Tanpura drone
├── assets/
│   ├── sounds/             # Audio files (metronome clicks, tanpura drones)
│   ├── icon.png            # App icon (1024x1024)
│   ├── splash.png          # Splash screen
│   └── adaptive-icon.png   # Android adaptive icon
├── scripts/
│   └── generate-sounds.js  # Generates placeholder audio
├── app.json                # Expo configuration
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## Customization

### Changing the Songbook URL

Edit `SONGBOOK_URL` in `app/(tabs)/index.tsx`:

```typescript
const SONGBOOK_URL = "https://your-domain.com/";
```

### Adding Real Tanpura Samples

Replace the files in `assets/sounds/` with high-quality recorded samples:
- `tanpura-sa.mp3` — Sa string (~4 seconds, C4/261Hz)
- `tanpura-pa.mp3` — Pa string (~4 seconds, G4/392Hz)  
- `tanpura-low-sa.mp3` — Low Sa (~4 seconds, C3/131Hz)
- `tanpura-ma.mp3` — Ma string (~4 seconds, F4/349Hz)

### App Icon

Replace `assets/icon.png` (1024×1024) and `assets/adaptive-icon.png` (1024×1024) with your app icon.

## Tech Stack

- **Expo SDK 52** — React Native framework
- **Expo Router** — File-based navigation
- **expo-av** — Audio recording and playback
- **react-native-webview** — WebView for songbook
- **@react-native-community/slider** — Native slider component

## Notes

- The Flute Tuner uses the device microphone and requires permission
- Tanpura plays in background mode so you can browse songs while practicing
- The metronome provides haptic feedback on each beat
- WebView caches content for offline access when possible
