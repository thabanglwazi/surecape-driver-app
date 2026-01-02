# Quick Setup Guide

## 1. Prerequisites Installed ✅
- Node.js and npm
- Expo dependencies
- React Navigation
- Supabase client

## 2. Next Steps

### A. Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `surecape-driver-app`
3. Make it **private**
4. Don't initialize with README (already exists)
5. Click "Create repository"

### B. Push to GitHub
```bash
cd /Users/thabangmathebula/CascadeProjects/surecape-driver-app
git remote set-url origin https://github.com/YOUR_USERNAME/surecape-driver-app.git
git push -u origin main
```

### C. Configure Environment Variables
Edit the `.env` file with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_URL=https://your-api.com
```

To find your Supabase credentials:
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings > API
4. Copy "Project URL" and "anon/public key"

### D. Test the App
```bash
# Make sure you're in the project directory
cd /Users/thabangmathebula/CascadeProjects/surecape-driver-app

# Start the development server
npm start

# Or use Expo CLI directly
npx expo start
```

This will open Expo Dev Tools. You can:
- Press `i` to open in iOS Simulator (Mac only)
- Press `a` to open in Android Emulator
- Scan QR code with Expo Go app on your phone

## 3. Database Setup

Ensure your Supabase database has these tables with proper relationships:

- `drivers` - Driver accounts
- `customers` - Customer information
- `bookings` - Trip bookings
- `driver_assignments` - Links drivers to bookings

### Required Columns

**drivers table:**
- id (uuid, primary key)
- email (text)
- full_name (text)
- phone_number (text)
- license_number (text, nullable)
- vehicle_type (text, nullable)
- is_active (boolean)
- created_at (timestamp)

**driver_assignments table:**
- id (uuid, primary key)
- driver_id (uuid, foreign key to drivers)
- booking_id (uuid, foreign key to bookings)
- status (text: 'assigned', 'accepted', 'declined', 'started', 'completed')
- assigned_at (timestamp)
- started_at (timestamp, nullable)
- completed_at (timestamp, nullable)
- notes (text, nullable)

## 4. Testing Login

To test the app, you need:
1. A driver account in Supabase Auth
2. Corresponding driver record in the `drivers` table with `is_active = true`

Create a test driver:
```sql
-- First create auth user in Supabase Auth dashboard

-- Then create driver record
INSERT INTO drivers (id, email, full_name, phone_number, is_active)
VALUES (
  'auth-user-uuid-here',
  'driver@test.com',
  'Test Driver',
  '+27123456789',
  true
);
```

## 5. Features to Test

Once running:
1. ✅ Login with driver credentials
2. ✅ View active trips (requires driver_assignments)
3. ✅ View trip details
4. ✅ Accept/decline trips
5. ✅ Start and complete trips
6. ✅ Call customer
7. ✅ Navigate to locations
8. ✅ View trip history
9. ✅ View profile
10. ✅ Sign out

## 6. Building for Production

### iOS (requires Mac)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build
eas build --platform ios
```

### Android
```bash
# Build APK for testing
eas build --platform android --profile preview

# Build AAB for Play Store
eas build --platform android --profile production
```

## 7. Troubleshooting

**Can't connect to Supabase?**
- Check .env file has correct values
- Restart expo server: `npm start --clear`

**Login not working?**
- Verify driver exists in both Auth and drivers table
- Check `is_active = true` in drivers table
- Verify email matches in both tables

**No trips showing?**
- Check driver_assignments table has records
- Verify driver_id matches your logged-in driver
- Check status is 'assigned', 'accepted', or 'started'

**Real-time not working?**
- Ensure Supabase Realtime is enabled for tables
- Check browser console for errors
- Restart the app

## Project Structure
```
surecape-driver-app/
├── src/
│   ├── screens/           # All app screens
│   │   ├── LoginScreen.tsx
│   │   ├── TripsScreen.tsx
│   │   ├── TripDetailScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── components/        # Reusable components
│   │   └── TripCard.tsx
│   ├── navigation/        # Navigation setup
│   │   └── AppNavigator.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── services/          # API services
│   │   └── supabase.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   └── utils/            # Utility functions
├── App.tsx               # Main entry point
├── package.json
├── .env                  # Environment variables
└── README.md
```

## Need Help?

Check the main README.md for detailed documentation or contact support.
