import * as Location from 'expo-location';
import { supabase } from './supabase';

// Foreground location tracking for Expo Go
let locationInterval: NodeJS.Timeout | null = null;
let currentDriverId: string | null = null;

interface LocationUpdate {
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

// Update driver location in database
const updateDriverLocation = async (driverId: string, location: Location.LocationObject) => {
  try {
    const locationUpdate: LocationUpdate = {
      driver_id: driverId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 0,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: new Date(location.timestamp).toISOString(),
    };

    // Save to location history
    const { error: historyError } = await supabase
      .from('driver_locations')
      .insert(locationUpdate);

    if (historyError) {
      console.error('Error saving location history:', historyError);
    }

    // Update current location in drivers table
    const { error: updateError } = await supabase
      .from('drivers')
      .update({
        current_latitude: location.coords.latitude,
        current_longitude: location.coords.longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driverId);

    if (updateError) {
      console.error('Error updating driver location:', updateError);
    } else {
      console.log('✅ Location updated:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });
    }
  } catch (error) {
    console.error('Error in updateDriverLocation:', error);
  }
};

// Request location permissions (foreground only for Expo Go)
export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('Foreground location permission denied');
      return false;
    }

    console.log('✅ Foreground location permission granted');
    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
};

// Check location permissions
export const checkLocationPermissions = async () => {
  try {
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();

    return {
      foreground: foregroundStatus === 'granted',
      background: false, // Not available in Expo Go
    };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return { foreground: false, background: false };
  }
};

// Check if location services are enabled
export const isLocationEnabled = async (): Promise<boolean> => {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch (error) {
    console.error('Error checking location services:', error);
    return false;
  }
};

// Start foreground location tracking with periodic updates
export const startLocationTracking = async (driverId: string): Promise<boolean> => {
  try {
    currentDriverId = driverId;

    // Check permissions
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground) {
      console.log('Location permission not granted');
      return false;
    }

    // Clear existing interval if any
    if (locationInterval) {
      clearInterval(locationInterval);
    }

    // Start periodic location updates (every 30 seconds)
    locationInterval = setInterval(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (currentDriverId) {
          await updateDriverLocation(currentDriverId, location);
        }
      } catch (error) {
        console.error('Error getting location update:', error);
      }
    }, 30000); // 30 seconds

    // Get initial location immediately
    const initialLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    await updateDriverLocation(driverId, initialLocation);

    console.log('✅ Foreground location tracking started (Expo Go mode)');
    console.log('⚠️  Note: Location tracking will stop when app is closed in Expo Go');
    console.log('💡 Use a development build for full background tracking');
    
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
};

// Stop location tracking
export const stopLocationTracking = async (): Promise<void> => {
  try {
    if (locationInterval) {
      clearInterval(locationInterval);
      locationInterval = null;
    }
    currentDriverId = null;
    console.log('✅ Location tracking stopped');
  } catch (error) {
    console.error('Error stopping location tracking:', error);
  }
};

// Get current location once
export const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location;
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};
