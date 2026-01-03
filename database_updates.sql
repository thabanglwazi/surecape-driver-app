-- Database schema updates for location tracking and trip management

-- 1. Add started_at column to driver_assignments table
ALTER TABLE driver_assignments 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- 2. Create driver_locations table for location history
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_timestamp ON driver_locations(timestamp);

-- 3. Add current location columns to drivers table
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS current_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS current_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- 4. Ensure driver_assignments status enum includes all required statuses
-- Note: If using an enum type, you may need to add 'in_progress' status:
-- ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'in_progress';

-- 5. Ensure bookings status enum includes 'in_progress'
-- Note: If using an enum type, you may need to add 'in_progress' status:
-- ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress';

-- 6. Add tracking_url column to bookings for customer tracking links (optional)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- 7. Create view for active driver locations (for admin/customer tracking)
CREATE OR REPLACE VIEW active_driver_locations AS
SELECT 
  d.id as driver_id,
  d.full_name as driver_name,
  d.phone as driver_phone,
  d.current_latitude,
  d.current_longitude,
  d.last_location_update,
  da.id as assignment_id,
  da.booking_id,
  da.status as trip_status,
  b.booking_id as booking_ref,
  b.status as booking_status
FROM drivers d
LEFT JOIN driver_assignments da ON d.id = da.driver_id AND da.status IN ('confirmed', 'in_progress')
LEFT JOIN bookings b ON da.booking_id = b.id
WHERE d.current_latitude IS NOT NULL 
  AND d.current_longitude IS NOT NULL
  AND d.status = 'active';

-- 8. Create function to generate tracking URLs (optional - for future implementation)
CREATE OR REPLACE FUNCTION generate_tracking_url(booking_ref TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'https://app.surecape.co.za/track/' || booking_ref;
END;
$$ LANGUAGE plpgsql;

-- 9. Add comments for documentation
COMMENT ON COLUMN driver_assignments.started_at IS 'Timestamp when driver confirmed pickup and started the trip';
COMMENT ON COLUMN drivers.current_latitude IS 'Current latitude of driver location';
COMMENT ON COLUMN drivers.current_longitude IS 'Current longitude of driver location';
COMMENT ON COLUMN drivers.last_location_update IS 'Last time driver location was updated';
COMMENT ON TABLE driver_locations IS 'Historical location data for driver tracking and analytics';
COMMENT ON VIEW active_driver_locations IS 'View of currently active drivers with their real-time locations';
