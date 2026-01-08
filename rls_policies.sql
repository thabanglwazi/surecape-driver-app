-- RLS Policies for Driver Location Tracking
-- Run this in your Supabase SQL Editor to enable location tracking

-- 1. Enable RLS on driver_locations table
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- 2. Allow authenticated users (drivers) to insert their own location data
CREATE POLICY "Drivers can insert their own locations"
ON driver_locations
FOR INSERT
TO authenticated
WITH CHECK (
  driver_id IN (
    SELECT id FROM drivers WHERE email = auth.email()
  )
);

-- 3. Allow drivers to read their own location history
CREATE POLICY "Drivers can read their own locations"
ON driver_locations
FOR SELECT
TO authenticated
USING (
  driver_id IN (
    SELECT id FROM drivers WHERE email = auth.email()
  )
);

-- 4. Allow public read access to active driver locations (for tracking)
CREATE POLICY "Public can read active driver locations"
ON driver_locations
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM driver_assignments da
    INNER JOIN drivers d ON da.driver_id = d.id
    WHERE d.id = driver_locations.driver_id
    AND da.status IN ('confirmed', 'in_progress')
  )
);

-- 5. Ensure drivers table allows updates to location fields
CREATE POLICY "Drivers can update their own location"
ON drivers
FOR UPDATE
TO authenticated
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- 6. Allow drivers to read their own record
CREATE POLICY "Drivers can read their own data"
ON drivers
FOR SELECT
TO authenticated
USING (email = auth.email());

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT, SELECT ON driver_locations TO authenticated;
GRANT SELECT, UPDATE ON drivers TO authenticated;

-- 8. Verify policies are active
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('driver_locations', 'drivers');
