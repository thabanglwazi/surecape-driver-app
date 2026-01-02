import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper functions for driver operations
export const driverService = {
  // Get driver by ID
  async getDriver(driverId: string) {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get driver's assigned trips
  async getDriverTrips(driverId: string, status?: string) {
    let query = supabase
      .from('driver_assignments')
      .select(`
        *,
        booking:bookings(
          *,
          customer:customers(*)
        )
      `)
      .eq('driver_id', driverId)
      .order('assigned_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get trip by ID
  async getTripById(tripId: string) {
    const { data, error } = await supabase
      .from('driver_assignments')
      .select(`
        *,
        booking:bookings(
          *,
          customer:customers(*)
        )
      `)
      .eq('id', tripId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update trip status
  async updateTripStatus(tripId: string, status: string, notes?: string) {
    const updateData: any = { status };
    
    if (status === 'started') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('driver_assignments')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Subscribe to new trip assignments
  subscribeToNewTrips(driverId: string, callback: (payload: any) => void) {
    return supabase
      .channel('driver-trips')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_assignments',
          filter: `driver_id=eq.${driverId}`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to trip updates
  subscribeToTripUpdates(driverId: string, callback: (payload: any) => void) {
    return supabase
      .channel('driver-trip-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_assignments',
          filter: `driver_id=eq.${driverId}`,
        },
        callback
      )
      .subscribe();
  },
};
