# Critical Android Background Service Configuration

## User Actions Required After Installing APK:

### 1. Battery Optimization (CRITICAL)
The app will show a dialog, but users MUST manually configure:

**Settings → Apps → SureCape Driver → Battery:**
- Select "Unrestricted" or "Don't optimize"

### 2. Autostart Permission (For Xiaomi, Huawei, Oppo, Vivo)
**Settings → Apps → SureCape Driver → Autostart:**
- Enable "Autostart" or "Auto-launch"

### 3. Background Activity (Samsung, OnePlus)
**Settings → Apps → SureCape Driver → Battery → Background restriction:**
- Select "Unrestricted"

### 4. Notification Settings
**Settings → Apps → SureCape Driver → Notifications:**
- Ensure "On Trip" notification category is enabled
- Set importance to "High" or "Urgent"

### 5. Location Settings
**Settings → Location → App permissions → SureCape Driver:**
- Select "Allow all the time"

## Testing Checklist:
1. Accept a trip
2. See persistent notification (cannot be swiped away)
3. Lock phone for 5 minutes
4. Unlock and check if notification still shows
5. Verify location updates in Supabase every 10 seconds

## Troubleshooting:
If tracking stops when app is closed:
1. Check if notification disappeared → Battery optimization is killing it
2. Check device manufacturer settings (Xiaomi, Huawei have aggressive battery management)
3. Ensure "Developer Options → Don't keep activities" is OFF
4. Disable any third-party battery saver apps
