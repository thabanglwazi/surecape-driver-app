import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking, Alert, AppState, AppStateStatus, NativeModules } from 'react-native';
import { supabase } from './supabase';
import BatteryOptimization from 'react-native-battery-optimization-check';

const LOCATION_TRACKING_TASK = 'background-location-tracking';
const DRIVER_ID_KEY = '@current_driver_id';
const TRACKING_ACTIVE_KEY = '@tracking_active';

// App state subscription for monitoring lifecycle
let appStateSubscription: any = null;
let lastAppState: AppStateStatus = 'active';

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
      try {
        // Check if battery optimization is enabled
        const isOptimizationEnabled = await BatteryOptimization.isBatteryOptimizationEnabled();
        console.log('📊 Battery optimization enabled:', isOptimizationEnabled);
        
        if (isOptimizationEnabled) {
          // Request to disable battery optimization
          Alert.alert(
            'Enable Unrestricted Battery',
            'SureCape Driver needs unrestricted battery access to track your location reliably when the phone is locked.\n\nTap "Allow" on the next screen to disable battery optimization.',
            [
              {
                text: 'Enable Now',
                onPress: async () => {
                  try {
                    await BatteryOptimization.requestOptimization();
                    console.log('✅ Battery optimization exemption requested');
                  } catch (err) {
                    console.error('❌ Failed to request exemption:', err);
                    // Fallback to settings
                    Linking.openSettings();
                  }
                },
              },
              {
                text: 'Later',
                style: 'cancel',
                onPress: () => console.log('⚠️ User postponed battery optimization'),
              },
            ]
          );
        } else {
          console.log('✅ Battery optimization already disabled');
        }
      } catch (err) {
        console.error('❌ Error checking battery optimization:', err);
      }
    }

    // Save driver ID to AsyncStorage for background task
    await AsyncStorage.setItem(DRIVER_ID_KEY, driverId);
    
    // Mark tracking as active
    await AsyncStorage.setItem(TRACKING_ACTIVE_KEY, 'true');
    
    // Start tracking with pure time-based updates (no distance dependency)
    await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 0, // No distance requirement - time only
      timeInterval: 10000, // Update every 10 seconds (time-based only)
      deferredUpdatesInterval: 10000, // Max 10 seconds between updates
      deferredUpdatesDistance: 0, // No distance dependency for deferred updates
      foregroundService: {
        notificationTitle: '🚗 SureCape Driver - Active Trip',
        notificationBody: 'Location tracking in progress. This notification cannot be dismissed.',
        notificationColor: '#008080',
        killServiceOnDestroy: false, // Keep service alive even if app is swiped away
      },
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false, // Never pause
      showsBackgroundLocationIndicator: true,
      mayShowUserSettingsDialog: false,
      // iOS specific settings
      ...(Platform.OS === 'ios' ? {
        allowsBackgroundLocationUpdates: true,
        showsBackgroundLocationIndicator: true,
      } : {}),
    });
    
    // Set up app state listener to restart tracking if needed
    if (!appStateSubscription) {
      appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
      console.log('✅ App state listener registered');
    }

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
      await AsyncStorage.removeItem(TRACKING_ACTIVE_KEY);
      
      // Remove app state listener
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
        console.log('✅ App state listener removed');
      }
      
      console.log('Location tracking stopped');
    }
  } catch (error) {
    console.error('Error stopping location tracking:', error);
  }
};

// Handle app state changes to restart tracking if needed
const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  console.log(`📱 App state: ${lastAppState} → ${nextAppState}`);
  
  // Detect wake from sleep: inactive/background → active
  const isWakingUp = (lastAppState === 'inactive' || lastAppState === 'background') && nextAppState === 'active';
  
  if (nextAppState === 'active') {
    // App came to foreground or device woke from sleep
    const shouldBeTracking = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
    const driverId = await AsyncStorage.getItem(DRIVER_ID_KEY);
    
    if (shouldBeTracking === 'true' && driverId) {
      if (isWakingUp) {
        console.log('🔄 Device woke from sleep - forcing tracking refresh...');
        // Stop and restart to refresh the service
        try {
          const isCurrentlyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
          if (isCurrentlyTracking) {
            await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
            console.log('⏸️ Stopped tracking for refresh');
          }
          // Wait a moment then restart
          await new Promise(resolve => setTimeout(resolve, 500));
          await startLocationTracking(driverId);
          console.log('✅ Tracking refreshed after wake');
        } catch (err) {
          console.error('❌ Error refreshing tracking:', err);
        }
      } else {
        // Regular foreground check
        const isCurrentlyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        
        if (!isCurrentlyTracking) {
          console.log('⚠️ Tracking stopped unexpectedly, restarting...');
          await startLocationTracking(driverId);
        } else {
          console.log('✅ Tracking still active');
        }
      }
    }
  }
  
  // Update last state
  lastAppState = nextAppState;
};

// Restore tracking if needed (after app restart)
export const restoreTrackingIfNeeded = async (driverId: string): Promise<void> => {
  try {
    const shouldBeTracking = await AsyncStorage.getItem(TRACKING_ACTIVE_KEY);
    const isCurrentlyTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    
    if (shouldBeTracking === 'true' && !isCurrentlyTracking) {
      console.log('🔄 Restoring location tracking after app restart...');
      await startLocationTracking(driverId);
    } else if (isCurrentlyTracking) {
      console.log('✅ Location tracking already active');
      // Still set up app state listener
      if (!appStateSubscription) {
        appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
        console.log('✅ App state listener registered');
      }
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
