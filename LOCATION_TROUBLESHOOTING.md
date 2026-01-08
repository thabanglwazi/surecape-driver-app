# Location Tracking Troubleshooting

## Issue: Location Not Syncing to Database

### Most Common Cause: RLS (Row Level Security) Policies

Supabase has Row Level Security enabled by default, which blocks all inserts/updates unless explicitly allowed.

### Solution: Apply RLS Policies

**Run the SQL script `rls_policies.sql` in your Supabase SQL Editor:**

```bash
# Located at: /rls_policies.sql
```

This will:
1. ✅ Allow authenticated drivers to INSERT their location data
2. ✅ Allow authenticated drivers to UPDATE their current location in drivers table
3. ✅ Allow drivers to READ their own location history
4. ✅ Allow public READ access for active trip tracking

### How to Apply:

1. **Open Supabase Dashboard** → Your Project
2. **Go to SQL Editor** (left sidebar)
3. **Click "New Query"**
4. **Copy/paste the entire contents of `rls_policies.sql`**
5. **Click "Run"**
6. **Verify** - You should see "Success" message

### Verify Policies Are Active:

Run this query in Supabase SQL Editor:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('driver_locations', 'drivers');
```

You should see policies like:
- "Drivers can insert their own locations"
- "Drivers can update their own location"
- "Drivers can read their own data"

### Other Potential Issues:

#### 1. Authentication Token Issues
- **Symptom**: `auth.email()` returns null in RLS policies
- **Fix**: Ensure driver is properly authenticated via Supabase Auth
- **Check**: `supabase.auth.getSession()` should return valid session

#### 2. Driver ID Not Found
- **Symptom**: Logs show "No driver ID found in storage"
- **Fix**: Driver must be logged in and have a record in `drivers` table
- **Check**: Query `SELECT * FROM drivers WHERE email = 'driver@email.com'`

#### 3. Network/Supabase Connection Issues
- **Symptom**: "Error saving location" in logs with network errors
- **Fix**: Check internet connection, verify Supabase project is active
- **Check**: Test Supabase connection from app

#### 4. Background Task Not Running
- **Symptom**: Location works in foreground, not in background
- **Fix**: Check Android permissions (ACCESS_BACKGROUND_LOCATION)
- **Check**: Look for "🔵 BACKGROUND TASK TRIGGERED" in logs

### Testing After Applying RLS Policies:

1. **Install latest APK**: [Check EAS builds](https://expo.dev/accounts/thabaglwazi/projects/surecape-driver-app/builds)
2. **Login as driver**
3. **Accept a trip**
4. **Watch console logs**:
   - ✅ Should see: "📍 Location updated successfully"
   - ❌ If you see: "Error saving location: new row violates row-level security policy"
   - → RLS policies not applied correctly

5. **Check database**:
   ```sql
   SELECT * FROM driver_locations 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```
   - Should see new rows appearing every 10 seconds

### Still Not Working?

Check these in order:

1. **Supabase Anon Key** - Verify `EXPO_PUBLIC_SUPABASE_ANON_KEY` is correct
2. **Driver Record** - Ensure driver exists in `drivers` table with matching email
3. **Auth Session** - Verify `supabase.auth.getSession()` returns valid session
4. **RLS Policies** - Run the verify query above to confirm policies exist
5. **Logs** - Check console for specific error messages

### Debug Mode:

The latest build includes extensive logging. Look for these log patterns:

```
✅ Location tracking started
🔍 Tracking status after 2s: ACTIVE ✅
📍 Test location: [lat], [lng]
✅ Test location save successful  ← If you see this, database write works!
🔵 BACKGROUND TASK TRIGGERED
👤 Driver ID from storage: [id]
💾 Updating location in database...
📍 Location updated successfully
```

If test location saves successfully but background doesn't, the issue is with background task execution, not database permissions.
