import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking, Alert } from 'react-native';
import { supabase } from './supabase';

const LOCATION_TRACKING_TASK = 'background-location-tracking';
const DRIVER_ID_KEY = '@current_driver_id';

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
  console.log('🔵 BACKGROUND TASK TRIGGERED');
  
  if (error) {
    console.error('❌ Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    console.log('📍 Location received:', location ? `${location.coords.latitude}, ${location.coords.longitude}` : 'null');

    if (location) {
      try {
        // Try to get driver ID from AsyncStorage first
        let driverId = await AsyncStorage.getItem(DRIVER_ID_KEY);
        console.log('👤 Driver ID from storage:', driverId);
        
        // If not in storage, try to get from session (app is open)
        if (!driverId) {
          console.log('⚠️ No driver ID in storage, fetching from session...');
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            const { data: driverData } = await supabase
              .from('drivers')
              .select('id')
              .eq('email', sessionData.session.user.email)
              .single();
            
            if (driverData?.id) {
              driverId = driverData.id;
              console.log('✅ Driver ID fetched from DB:', driverId);
              // Save for next time
              await AsyncStorage.setItem(DRIVER_ID_KEY, driverId);
            }
          }
        }

        if (driverId) {
          console.log('💾 Updating location in database...');
          await updateDriverLocation(driverId, location);
        } else {
          console.error('❌ No driver ID available');
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
    console.log('Starting location tracking for driver:', driverId);
    
    // Check if already tracking
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (isTracking) {
      console.log('Location tracking already active');
      return true;
    }

    // Check permissions
    const permissions = await checkLocationPermissions();
    if (!permissions.foreground || !permissions.background) {
      console.error('Missing location permissions', permissions);
      return false;
    }

    // Request battery optimization exemption for Android
    if (Platform.OS === 'android') {
      const hasRequested = await AsyncStorage.getItem('@battery_exemption_requested');
      if (!hasRequested) {
        Alert.alert(
          'Battery Optimization Required',
          'For reliable GPS tracking when the phone is locked, please disable battery optimization for SureCape Driver.\n\nThis ensures location updates continue in the background.',
          [
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
            {
              text: 'Later',
              style: 'cancel',
            },
          ]
        );
        await AsyncStorage.setItem('@battery_exemption_requested', 'true');
      }
    }

    // Save driver ID to AsyncStorage for background task
    await AsyncStorage.setItem(DRIVER_ID_KEY, driverId);
    
    // Start tracking with aggressive foreground service settings
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 50, // More frequent updates
      timeInterval: 5000, // Every 5 seconds
      deferredUpdatesInterval: 5000,
      deferredUpdatesDistance: 50,
      foregroundService: {
        notificationTitle: '🚗 SureCape Driver - On Trip',
        notificationBody: 'Tracking your location. Do not dismiss this notification.',
        notificationColor: '#008080',
        killServiceOnDestroy: false, // Keep service alive
      },
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false, // Never pause
      showsBackgroundLocationIndicator: true,
      mayShowUserSettingsDialog: false,
    });

    console.log('✅ Location tracking started');
    
    // Verify tracking actually started
    setTimeout(async () => {
      const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      console.log('🔍 Tracking status after 2s:', isActive ? 'ACTIVE ✅' : 'INACTIVE ❌');
      
      // Get current location to test database connection
      try {
        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        console.log('📍 Test location:', currentLoc.coords.latitude, currentLoc.coords.longitude);
        await updateDriverLocation(driverId, currentLoc);
        console.log('✅ Test location save successful');
      } catch (testErr) {
        console.error('❌ Test location failed:', testErr);
      }
    }, 2000);
    
    return true;
  } catch (error) {
    console.error('❌ Error starting location tracking:', error);
    return false;
  }
};

// Stop background location tracking
export const stopLocationTracking = async (): Promise<void> => {
  try {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      await AsyncStorage.removeItem(DRIVER_ID_KEY);
      console.log('Location tracking stopped');
    }
  } catch (error) {
    console.error('Error stopping location tracking:', error);
  }
};

// Restore tracking if needed (after app restart)
// Restore tracking if needed (after app restart)
export const restoreTrackingIfNeeded = async (driverId: string): Promise<void> => {
  try {
    const isCurrentlyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    
    if (!isCurrentlyTracking) {
      console.log('Restoring location tracking...');
      await startLocationTracking(driverId);
    }
  } catch (error) {
    console.error('Error restoring tracking:', error);
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
