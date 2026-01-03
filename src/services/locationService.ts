import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

const LOCATION_TRACKING_TASK = 'background-location-tracking';

// Interface for location update
interface LocationUpdate {
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

// Define the background location task
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      try {
        // Get driver ID from storage or session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;

        const { data: driverData } = await supabase
          .from('drivers')
          .select('id')
          .eq('email', sessionData.session.user.email)
          .single();

        if (driverData) {
          // Update driver location in database
          await updateDriverLocation(driverData.id, location);
        }
      } catch (err) {
        console.error('Error updating location:', err);
      }
    }
  }
});

// Update driver location in Supabase
export const updateDriverLocation = async (
  driverId: string,
  location: Location.LocationObject
) => {
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

    // Insert location into driver_locations table
    const { error } = await supabase
      .from('driver_locations')
      .insert([locationUpdate]);

    if (error) {
      console.error('Error saving location:', error);
    } else {
      console.log('📍 Location updated successfully');
    }

    // Also update the latest location in drivers table
    await supabase
      .from('drivers')
      .update({
        current_latitude: location.coords.latitude,
        current_longitude: location.coords.longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driverId);

  } catch (error) {
    console.error('Error in updateDriverLocation:', error);
  }
};

// Request location permissions
export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    // Request foreground permissions first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('Foreground location permission denied');
      return false;
    }

    // Request background permissions
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.log('Background location permission denied');
      return false;
    }

    console.log('✅ All location permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
};

// Check if location permissions are granted
export const checkLocationPermissions = async (): Promise<{
  foreground: boolean;
  background: boolean;
}> => {
  try {
    const foregroundPermission = await Location.getForegroundPermissionsAsync();
    const backgroundPermission = await Location.getBackgroundPermissionsAsync();

    return {
      foreground: foregroundPermission.status === 'granted',
      background: backgroundPermission.status === 'granted',
    };
  } catch (error) {
    console.error('Error checking location permissions:', error);
    return { foreground: false, background: false };
  }
};

// Start background location tracking
export const startLocationTracking = async (driverId: string): Promise<boolean> => {
  try {
    // Check if already tracking
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    
    if (isTracking) {
      console.log('Location tracking already active');
      return true;
    }

    // Check permissions
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground || !permissions.background) {
      console.log('Missing location permissions');
      return false;
    }

    // Start tracking with high accuracy
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 50, // Update every 50 meters
      timeInterval: 30000, // Update every 30 seconds
      foregroundService: {
        notificationTitle: 'SureCape Driver',
        notificationBody: 'Location tracking is active',
        notificationColor: '#134e5e',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('✅ Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
};

// Stop background location tracking
export const stopLocationTracking = async (): Promise<void> => {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      console.log('Location tracking stopped');
    }
  } catch (error) {
    console.error('Error stopping location tracking:', error);
  }
};

// Get current location once
export const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
  try {
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground) {
      console.log('Foreground location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return location;
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
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
