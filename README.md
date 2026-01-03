# SureCape Driver App

A cross-platform mobile application for SureCape drivers built with React Native (Expo) and TypeScript.

## 📚 Documentation

- **[Integration Analysis](WEB_APP_INTEGRATION_ANALYSIS.md)** - Complete web app integration guide
- **[Integration Summary](INTEGRATION_SUMMARY.md)** - What was done and next steps
- **[Quick Reference](QUICK_REFERENCE.md)** - Quick lookup for common patterns
- **[Setup Guide](SETUP.md)** - Initial setup instructions

## Features

- 📱 **Cross-platform**: Runs on both iOS and Android
- 🔐 **Authentication**: Secure driver login with Supabase
- 📍 **Real-time Trip Updates**: Instant notifications for new trip assignments
- 🗺️ **Trip Management**: View assigned trips, customer details, and navigation
- 📸 **Trip Documentation**: Take photos for trip completion
- 🔔 **Push Notifications**: Get alerted for new assignments
- 📊 **Trip History**: View past trips and earnings

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation
- **Backend**: Supabase (PostgreSQL, Realtime, Authentication)
- **State Management**: React Context API
- **Notifications**: Expo Notifications

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode (Mac only)
- For Android: Android Studio
- Expo Go app on your mobile device for testing

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://your-api.com
```

### 3. Run the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS (Mac only)
npm run ios

# Run on web
npm run web
```

### 4. Testing on Physical Device

1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Scan the QR code from the terminal
3. The app will open in Expo Go

## Project Structure

```
surecape-driver-app/
├── src/
│   ├── screens/          # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── TripsScreen.tsx
│   │   ├── TripDetailScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── components/       # Reusable components
│   │   ├── TripCard.tsx
│   │   └── LoadingSpinner.tsx
│   ├── navigation/       # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── services/         # API and Supabase services
│   │   ├── supabase.ts
│   │   └── notifications.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   └── utils/           # Utility functions
│       └── helpers.ts
├── App.tsx              # Main app entry point
├── package.json
└── README.md
```

## Building for Production

### Android (APK/AAB)

```bash
# Build APK for testing
eas build --platform android --profile preview

# Build AAB for Google Play Store
eas build --platform android --profile production
```

### iOS (IPA)

```bash
# Build for App Store
eas build --platform ios --profile production
```

## Key Features Implementation

### Authentication
- Drivers log in with email/phone and password
- Session persisted with AsyncStorage
- Automatic token refresh

### Real-time Updates
- Supabase Realtime subscriptions for trip assignments
- Push notifications for new trips
- Auto-refresh trip list

### Trip Management
- View all assigned trips
- Accept/decline trip assignments
- Start trip, update status, complete trip
- View customer contact information
- Navigate to pickup/dropoff locations

### Notifications
- Push notifications for new trip assignments
- In-app notifications for status changes
- Background notification handling

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `EXPO_PUBLIC_API_URL` | Backend API URL |

## Deployment

### Expo EAS (Recommended)

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Configure: `eas build:configure`
4. Build: `eas build --platform all`
5. Submit: `eas submit --platform all`

## Troubleshooting

### Metro Bundler Issues
```bash
npx expo start --clear
```

### iOS Build Issues
```bash
cd ios && pod install && cd ..
```

### Android Build Issues
```bash
cd android && ./gradlew clean && cd ..
```

## Support

For issues or questions, contact: support@surecape.co.za

## License

Proprietary - SureCape © 2026
