import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { Driver, AuthContextType } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestLocationPermissions,
  checkLocationPermissions,
  startLocationTracking,
  stopLocationTracking,
  isLocationEnabled,
} from '../services/locationServiceExpoDev';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('===== AUTH PROVIDER RENDERING =====', { loading, hasDriver: !!driver });

  useEffect(() => {
    console.log('===== AUTH PROVIDER MOUNTED =====');
    // Check if user is already logged in with timeout
    const timeoutId = setTimeout(() => {
      console.log('Session check timeout - forcing loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    checkSession().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, []);

  const checkSession = async () => {
    try {
      console.log('Checking session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        console.log('Session found for user:', session.user.email);
        setUser(session.user);
        // Fetch driver data
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        if (driverError) {
          console.error('Driver fetch error:', driverError);
          // If it's a 406 or permission error, user might not be authenticated properly
          if (driverError.code === 'PGRST116' || driverError.message?.includes('406')) {
            // Clear invalid session
            await supabase.auth.signOut();
          }
        } else if (driverData) {
          console.log('Driver data loaded:', driverData.email);
          setDriver(driverData);
        }
      } else {
        console.log('No active session found');
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      console.log('Session check complete, setting loading to false');
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    // Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw authError;
    }

    console.log('Auth successful, user:', authData.user?.email);

    // Fetch driver data using email
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('email', email)
      .single();

    console.log('Driver query - data:', driverData, 'error:', driverError);

    if (driverError) {
      console.error('Driver fetch error:', driverError);
      // Clear the auth session since driver doesn't exist
      await supabase.auth.signOut();
      
      if (driverError.code === 'PGRST116') {
        throw new Error('Your account is not registered as a driver. Please contact support@surecape.co.za to be added as a driver.');
      }
      throw new Error(`Driver not found: ${driverError.message}`);
    }

    if (!driverData) {
      await supabase.auth.signOut();
      throw new Error('Your account is not registered as a driver. Please contact support@surecape.co.za');
    }

    if (driverData.status !== 'active') {
      throw new Error('Driver account is inactive');
    }

    setDriver(driverData);

    // Request and enforce location permissions after successful login
    await enforceLocationPermissions(driverData.id);
  };

  const enforceLocationPermissions = async (driverId: string) => {
    try {
      // Check if location services are enabled
      const locationEnabled = await isLocationEnabled();
      if (!locationEnabled) {
        Alert.alert(
          'Location Services Required',
          'Please enable location services in your device settings to continue.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Check current permissions
      const permissions = await checkLocationPermissions();
      
      if (!permissions.foreground || !permissions.background) {
        // Request permissions
        const granted = await requestLocationPermissions();
        
        if (!granted) {
          Alert.alert(
            'Location Permission Required',
            'SureCape Driver requires location access to track your trips and provide accurate ETAs to customers. Please grant location permissions (including "Always Allow") to continue.',
            [
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
              { 
                text: 'Try Again', 
                onPress: () => enforceLocationPermissions(driverId) 
              },
            ]
          );
          return;
        }
      }

      // Start background location tracking
      const trackingStarted = await startLocationTracking(driverId);
      if (trackingStarted) {
        console.log('✅ Location tracking started for driver:', driverId);
      } else {
        console.error('Failed to start location tracking');
      }
    } catch (error) {
      console.error('Error enforcing location permissions:', error);
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // Stop location tracking before signing out
      await stopLocationTracking();
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Ignore "Auth session missing" error - user is already signed out
        if (error.message !== 'Auth session missing!') {
          console.error('Supabase sign out error:', error);
          throw error;
        } else {
          console.log('No active session to sign out');
        }
      }
      await AsyncStorage.clear();
      setDriver(null);
      setUser(null);
      console.log('Sign out completed successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        driver,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
