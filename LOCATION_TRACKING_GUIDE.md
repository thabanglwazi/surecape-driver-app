# Location Tracking Link Implementation Guide

## Problem
Location tracking links are not available in the admin panel and customer view, making it impossible to track driver locations in real-time.

## Solution Overview
Implement a tracking URL system that allows admins and customers to view driver locations on a map in real-time.

## Implementation Steps

### 1. Database Setup
Run the SQL in `database_updates.sql` to add:
- `tracking_url` column to bookings table
- `active_driver_locations` view for admin dashboard
- Helper function for generating tracking URLs

### 2. Generate Tracking URLs When Booking is Confirmed

In your web app's driver assignment service, update the `assignDriverToBooking` function:

```javascript
// In /src/services/driverService.js or equivalent

const assignDriverToBooking = async (bookingId, driverId, vehicleIds) => {
  // ... existing assignment logic ...

  // Generate tracking URL
  const trackingUrl = `https://app.surecape.co.za/track/${booking.booking_id}`;
  
  // Update booking with tracking URL
  const { error: trackingError } = await supabase
    .from('bookings')
    .update({ tracking_url: trackingUrl })
    .eq('id', bookingId);

  if (trackingError) {
    console.error('Error adding tracking URL:', trackingError);
  }

  // ... rest of the code ...
};
```

### 3. Send Tracking Link in Email Notifications

Update your email service to include the tracking link:

```javascript
// In driver confirmation email
const driverConfirmationEmail = {
  to: customerEmail,
  subject: 'Driver Assigned - SureCape Trip Confirmation',
  html: `
    <h2>Your Driver Has Been Assigned</h2>
    <p>Driver: ${driverName}</p>
    <p>Vehicle: ${vehicleMake} ${vehicleModel} (${licensePlate})</p>
    <p>
      <strong>Track your driver in real-time:</strong><br>
      <a href="${trackingUrl}" style="background-color: #008080; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
        📍 Track Driver Location
      </a>
    </p>
    <!-- rest of email content -->
  `
};
```

### 4. Create Tracking Page Component (Web App)

Create a new page at `/src/pages/TrackingPage.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';

const TrackingPage = () => {
  const { bookingRef } = useParams();
  const [booking, setBooking] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingData();
    
    // Subscribe to driver location updates
    const subscription = supabase
      .channel('driver-location-tracking')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: \`id=eq.\${booking?.driver_id}\`
        },
        (payload) => {
          console.log('Driver location updated:', payload);
          setDriverLocation({
            lat: payload.new.current_latitude,
            lng: payload.new.current_longitude,
            timestamp: payload.new.last_location_update
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingRef, booking?.driver_id]);

  const loadBookingData = async () => {
    try {
      // Get booking by booking_id reference
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(\`
          *,
          driver_assignments!inner(
            *,
            driver:drivers(*)
          )
        \`)
        .eq('booking_id', bookingRef)
        .single();

      if (bookingError) throw bookingError;

      setBooking(bookingData);

      // Get current driver location
      const driverId = bookingData.driver_assignments[0]?.driver_id;
      if (driverId) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('current_latitude, current_longitude, last_location_update')
          .eq('id', driverId)
          .single();

        if (driverData?.current_latitude) {
          setDriverLocation({
            lat: driverData.current_latitude,
            lng: driverData.current_longitude,
            timestamp: driverData.last_location_update
          });
        }
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading tracking information...</div>;
  }

  if (!booking) {
    return <div>Booking not found</div>;
  }

  const driver = booking.driver_assignments[0]?.driver;
  const tripDetails = booking.trip_details;
  const pickupLocation = tripDetails?.from?.coordinates;
  const dropoffLocation = tripDetails?.to?.coordinates;

  const mapCenter = driverLocation || pickupLocation || { lat: -33.9249, lng: 18.4241 };

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <div style={{ padding: '20px', background: '#008080', color: 'white' }}>
        <h2>Track Your Ride - Booking #{bookingRef}</h2>
        {driver && (
          <div>
            <p><strong>Driver:</strong> {driver.full_name}</p>
            <p><strong>Phone:</strong> {driver.phone}</p>
            <p><strong>Status:</strong> {booking.status.toUpperCase()}</p>
            {driverLocation?.timestamp && (
              <p><strong>Last Updated:</strong> {new Date(driverLocation.timestamp).toLocaleTimeString()}</p>
            )}
          </div>
        )}
      </div>

      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={{ height: 'calc(100vh - 200px)', width: '100%' }}
          center={mapCenter}
          zoom={13}
        >
          {/* Driver current location */}
          {driverLocation && (
            <Marker
              position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: { width: 40, height: 40 }
              }}
              label={{
                text: '🚗',
                fontSize: '24px'
              }}
            />
          )}

          {/* Pickup location */}
          {pickupLocation && (
            <Marker
              position={{ lat: pickupLocation.lat, lng: pickupLocation.lng }}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
              }}
              label="Pickup"
            />
          )}

          {/* Dropoff location */}
          {dropoffLocation && (
            <Marker
              position={{ lat: dropoffLocation.lat, lng: dropoffLocation.lng }}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
              }}
              label="Drop-off"
            />
          )}

          {/* Route line */}
          {driverLocation && dropoffLocation && (
            <Polyline
              path={[
                { lat: driverLocation.lat, lng: driverLocation.lng },
                { lat: dropoffLocation.lat, lng: dropoffLocation.lng }
              ]}
              options={{
                strokeColor: '#008080',
                strokeWeight: 3,
                strokeOpacity: 0.7
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default TrackingPage;
```

### 5. Add Route in Web App

In your `App.js` or router configuration:

```javascript
import TrackingPage from './pages/TrackingPage';

// Add route
<Route path="/track/:bookingRef" element={<TrackingPage />} />
```

### 6. Display Tracking Link in Admin Dashboard

In your bookings management page:

```javascript
const BookingRow = ({ booking }) => {
  const trackingUrl = booking.tracking_url || `https://app.surecape.co.za/track/${booking.booking_id}`;

  return (
    <tr>
      <td>{booking.booking_id}</td>
      <td>{booking.customer_name}</td>
      <td>{booking.status}</td>
      <td>
        {booking.status !== 'pending' && (
          <a 
            href={trackingUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="tracking-link"
          >
            📍 Track Driver
          </a>
        )}
      </td>
    </tr>
  );
};
```

### 7. Display Tracking Link in Customer Booking View

In customer's booking history/details page:

```javascript
const CustomerBookingDetails = ({ booking }) => {
  return (
    <div>
      <h3>Booking #{booking.booking_id}</h3>
      {/* ... other booking details ... */}
      
      {(booking.status === 'confirmed' || booking.status === 'in_progress') && booking.tracking_url && (
        <div className="tracking-section">
          <h4>Track Your Driver</h4>
          <a 
            href={booking.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            📍 View Driver Location
          </a>
        </div>
      )}
    </div>
  );
};
```

## Testing Checklist

- [ ] Database columns and views created successfully
- [ ] Tracking URL generated when driver is assigned
- [ ] Tracking URL sent in driver confirmation email
- [ ] Tracking page loads correctly with booking details
- [ ] Map displays driver's current location
- [ ] Location updates in real-time (every 30 seconds)
- [ ] Pickup and drop-off markers display correctly
- [ ] Admin can access tracking link from dashboard
- [ ] Customer can access tracking link from booking details
- [ ] Tracking link works for customers without login
- [ ] Mobile responsive design for tracking page

## Security Considerations

1. **Public Access**: The tracking page should be accessible without authentication (using booking_id as the key)
2. **RLS Policy**: Ensure Supabase RLS allows read access to bookings and driver locations for public tracking
3. **Rate Limiting**: Consider rate limiting on the tracking endpoint to prevent abuse

### RLS Policy for Public Tracking

```sql
-- Allow public read access to bookings for tracking (by booking_id only)
CREATE POLICY "Allow public tracking by booking_id"
ON bookings FOR SELECT
USING (true);

-- Allow public read access to driver current location (for active trips only)
CREATE POLICY "Allow public read driver location for active trips"
ON drivers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM driver_assignments da
    WHERE da.driver_id = drivers.id
    AND da.status IN ('confirmed', 'in_progress')
  )
);
```

## Next Steps

1. Run the database migration SQL
2. Update driver assignment logic to generate tracking URLs
3. Create tracking page component
4. Add tracking links to emails
5. Update admin and customer interfaces
6. Test end-to-end tracking flow
7. Deploy to production

## Support

If you need help with implementation, check:
- Google Maps API documentation
- Supabase real-time subscriptions guide
- React Router documentation for dynamic routes
