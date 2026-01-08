import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { sendDriverConfirmationEmail, sendTripCompletionEmail } from './emailService';
import { 
  sendTripConfirmationNotification, 
  sendTripStartedNotification, 
  sendTripCompletedNotification 
} from './whatsappService';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('=== SUPABASE CONFIG ===');
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);
console.log('Supabase Key length:', supabaseAnonKey?.length);
console.log('First 20 chars of key:', supabaseAnonKey?.substring(0, 20));
console.log('=======================');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars - URL:', supabaseUrl, 'Key:', !!supabaseAnonKey);
  throw new Error('Missing Supabase environment variables');
}

// Use localStorage for web, AsyncStorage for native
const storage = Platform.OS === 'web' ? {
  getItem: (key: string) => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  },
} : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

console.log('Supabase client initialized');

// Helper functions for driver operations
export const driverService = {
  // Get driver by ID with full vehicle details
  async getDriver(driverId: string) {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();
    
    if (error) throw error;
    
    // Parse vehicle_info and return with vehicles array
    return {
      ...data,
      vehicles: data.vehicle_info?.vehicles || []
    };
  },

  // Get driver by phone number (for authentication)
  async getDriverByPhone(phone: string) {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('phone', phone)
      .eq('status', 'active')
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      vehicles: data.vehicle_info?.vehicles || []
    };
  },

  // Get driver's assigned trips
  async getDriverTrips(driverId: string, statusFilter?: string) {
    // First, let's check what unique status values exist in the database
    const { data: allStatuses } = await supabase
      .from('driver_assignments')
      .select('status')
      .limit(100);
    
    if (allStatuses) {
      const uniqueStatuses = [...new Set(allStatuses.map(a => a.status))];
      console.log('All unique statuses in driver_assignments table:', uniqueStatuses);
    }
    
    let query = supabase
      .from('driver_assignments')
      .select(`
        *,
        booking:bookings(
          *,
          customer:customers(*)
        ),
        driver:drivers(
          full_name,
          phone,
          vehicle_info
        )
      `)
      .eq('driver_id', driverId)
      .order('assigned_at', { ascending: false });

    if (statusFilter) {
      // Handle multiple statuses separated by comma
      const statuses = statusFilter.split(',').map(s => s.trim());
      query = query.in('status', statuses);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Log actual status values from database
    if (data && data.length > 0) {
      console.log('Sample trip statuses from DB:', data.slice(0, 3).map(d => d.status));
    }
    
    // Extract locations from trip_details and format them
    const enrichedData = data.map((assignment) => {
      const tripDetails = assignment.booking?.trip_details;
      
      const pickupLocation = tripDetails?.from?.address 
        ? { address: tripDetails.from.address }
        : null;
        
      const dropoffLocation = tripDetails?.to?.address
        ? { address: tripDetails.to.address }
        : null;
      
      const selectedVehicles = assignment.selected_vehicle_id && assignment.driver?.vehicle_info?.vehicles
        ? assignment.driver.vehicle_info.vehicles.filter((v: any) => 
            assignment.selected_vehicle_id.includes(v.id)
          )
        : [];
      
      return {
        ...assignment,
        booking: {
          ...assignment.booking,
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          number_of_passengers: tripDetails?.passengers || 0,
          vehicle_type: tripDetails?.vehicle || 'N/A'
        },
        selected_vehicles: selectedVehicles
      };
    });
    
    return enrichedData;
  },

  // Get trip by ID with full details
  async getTripById(tripId: string) {
    console.log('=== GET TRIP BY ID ===');
    console.log('Trip ID:', tripId);
    
    const { data, error } = await supabase
      .from('driver_assignments')
      .select(`
        *,
        booking:bookings(
          *,
          customer:customers(*)
        ),
        driver:drivers(
          id,
          full_name,
          phone,
          vehicle_info
        )
      `)
      .eq('id', tripId)
      .single();

    console.log('Database query result:');
    console.log('- Error:', error);
    console.log('- Has data?', !!data);
    console.log('- Has booking?', !!data?.booking);
    console.log('- Has customer table data?', !!data?.booking?.customer);
    console.log('- Has customer in trip_details?', !!data?.booking?.trip_details?.customerInfo);
    if (data?.booking?.trip_details?.customerInfo) {
      console.log('- Customer name:', data.booking.trip_details.customerInfo.name);
      console.log('- Customer email:', data.booking.trip_details.customerInfo.email);
      console.log('- Customer phone:', data.booking.trip_details.customerInfo.phone);
    } else if (data?.booking?.customer) {
      console.log('- Customer name:', data.booking.customer.name);
      console.log('- Customer email:', data.booking.customer.email);
      console.log('- Customer phone:', data.booking.customer.phone || data.booking.customer.cell);
    }

    if (error) throw error;
    
    // Extract locations from trip_details
    const tripDetails = data.booking?.trip_details;
    
    const pickupLocation = tripDetails?.from?.address 
      ? { address: tripDetails.from.address }
      : null;
      
    const dropoffLocation = tripDetails?.to?.address
      ? { address: tripDetails.to.address }
      : null;
    
    // Extract selected vehicle details
    // The selected_vehicle JSONB column should contain the full vehicle details
    // populated by the web app when assigning a driver
    console.log('Vehicle data:', {
      selected_vehicle_id: data.selected_vehicle_id,
      selected_vehicle_jsonb: data.selected_vehicle
    });
    
    let selectedVehicles = [];
    
    // Check if vehicle details are stored in selected_vehicle JSONB column
    // This is populated by the web app when a fleet vehicle is assigned
    if (data.selected_vehicle) {
      const vehicleData = Array.isArray(data.selected_vehicle) 
        ? data.selected_vehicle 
        : [data.selected_vehicle];
      selectedVehicles = vehicleData;
      console.log('✅ Fleet vehicles from selected_vehicle:', selectedVehicles);
    } else if (data.selected_vehicle_id && data.selected_vehicle_id.length > 0) {
      // Fallback: query fleet_vehicles table directly
      const vehicleIds = Array.isArray(data.selected_vehicle_id) 
        ? data.selected_vehicle_id 
        : [data.selected_vehicle_id];
      
      console.log('Querying fleet_vehicles by IDs:', vehicleIds);
      
      try {
        const { data: vehiclesData, error: vehiclesError } = await supabase
          .from('fleet_vehicles')
          .select('*')
          .in('id', vehicleIds);
        
        if (vehiclesError) {
          console.error('Error fetching fleet vehicles:', vehiclesError);
        } else if (vehiclesData && vehiclesData.length > 0) {
          console.log('✅ Fleet vehicles fetched:', vehiclesData);
          selectedVehicles = vehiclesData;
        } else {
          console.warn('⚠️ No fleet vehicles found with IDs:', vehicleIds);
        }
      } catch (err) {
        console.error('Exception fetching fleet vehicles:', err);
      }
    }
    
    // Note: drivers and fleet vehicles are separate entities
    // driver.vehicle_info is NOT used - fleet vehicles are managed separately
    // The web app assigns fleet vehicles and stores their details in selected_vehicle
    
    // Fallback: if still no vehicles (shouldn't happen after web app fix)
    if (selectedVehicles.length === 0 && data.selected_vehicle_id && data.driver?.vehicle_info?.vehicles) {
      const vehicleIds = Array.isArray(data.selected_vehicle_id) 
        ? data.selected_vehicle_id 
        : [data.selected_vehicle_id];
        
      const vehiclesFromInfo = data.driver.vehicle_info.vehicles.filter((v: any) => 
        vehicleIds.includes(v.id)
      );
      
      if (vehiclesFromInfo.length > 0) {
        console.log('✅ Vehicles found in driver vehicle_info:', vehiclesFromInfo);
        selectedVehicles = vehiclesFromInfo;
      }
    }
    
    console.log('Selected vehicles final:', selectedVehicles);
    
    return {
      ...data,
      booking: {
        ...data.booking,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        number_of_passengers: tripDetails?.passengers || 0,
        vehicle_type: tripDetails?.vehicle || 'N/A'
      },
      selected_vehicles: selectedVehicles
    };
  },

  // Update trip status
  async updateTripStatus(tripId: string, status: string, notes?: string) {
    console.log('=== UPDATE TRIP STATUS ===');
    console.log('Trip ID:', tripId);
    console.log('New Status (received):', status, 'Type:', typeof status);
    console.log('Notes:', notes);
    
    // Map mobile app statuses to database statuses
    // Database has: assigned, confirmed, in_progress, completed, cancelled
    const statusMap: { [key: string]: string } = {
      'accepted': 'confirmed',
      'started': 'in_progress',
      'completed': 'completed',
      'declined': 'cancelled'
    };
    
    const dbStatus = statusMap[status.toLowerCase().trim()] || status;
    console.log('Mapped DB Status:', dbStatus, 'Type:', typeof dbStatus);
    
    // Save the original status for notification logic
    const originalStatus = status.toLowerCase().trim();
    
    const updateData: any = { status: dbStatus };
    
    if (notes) {
      updateData.notes = notes;
    }
    
    // Add timestamps based on status
    if (originalStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    console.log('Update data:', JSON.stringify(updateData));

    const { data, error } = await supabase
      .from('driver_assignments')
      .update(updateData)
      .eq('id', tripId)
      .select(`
        *,
        booking:bookings(
          *,
          customer:customers(*)
        ),
        driver:drivers(full_name, phone, vehicle_info)
      `)
      .single();

    if (error) {
      console.error('=== UPDATE ERROR ===');
      console.error('Error:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log('=== UPDATE SUCCESS ===');
    console.log('Updated status:', data.status);
    
    // Also update the booking status to match
    if (data.booking_id) {
      const now = new Date().toISOString();
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          status: dbStatus,
          updated_at: now
        })
        .eq('id', data.booking_id);
        
      if (bookingError) {
        console.error('Failed to update booking status:', bookingError);
      } else {
        console.log('✅ Booking status also updated to:', dbStatus);
      }
    }
    
    // Send notifications (Email + WhatsApp) based on status change
    console.log('=== SENDING NOTIFICATIONS ===');
    console.log('Checking notifications for status:', status);
    try {
      // Get full trip details with locations
      console.log('Fetching trip details for notifications...');
      const tripWithLocations = await this.getTripById(tripId);
      console.log('Trip details fetched:', {
        hasBooking: !!tripWithLocations.booking,
        hasCustomer: !!tripWithLocations.booking?.customer,
        hasCustomerInTripDetails: !!tripWithLocations.booking?.trip_details?.customerInfo,
        customerEmail: tripWithLocations.booking?.customer?.email || tripWithLocations.booking?.trip_details?.customerInfo?.email
      });
      
      // Customer data is in trip_details.customerInfo, not a separate table
      const customerEmail = tripWithLocations.booking?.trip_details?.customerInfo?.email || tripWithLocations.booking?.customer?.email;
      const customerName = tripWithLocations.booking?.trip_details?.customerInfo?.name || tripWithLocations.booking?.customer?.name || 'Valued Customer';
      const customerPhone = tripWithLocations.booking?.trip_details?.customerInfo?.phone || tripWithLocations.booking?.customer?.phone || '';
      
      // Include selected vehicle in driver data
      const selectedVehicle = tripWithLocations.selected_vehicles?.[0];
      const driverData = {
        ...(tripWithLocations.driver || {}),
        vehicle: selectedVehicle,
        selectedVehicle: selectedVehicle
      };
      
      console.log('Notification recipient data:', {
        customerName,
        customerEmail,
        customerPhone,
        customerPhoneType: typeof customerPhone,
        customerPhoneLength: customerPhone?.length,
        driverName: driverData.full_name,
        driverPhone: driverData.phone,
        hasVehicle: !!selectedVehicle
      });
      
      if (!customerEmail && !customerPhone) {
        console.warn('⚠️ No customer contact info found, skipping notifications');
        return data;
      }
      
      // Extract trip details for notifications
      const tripDetails = tripWithLocations.booking?.trip_details || {};
      const bookingData = {
        bookingId: tripWithLocations.booking?.booking_id || tripWithLocations.booking?.id,
        pickupDate: tripWithLocations.booking?.pickup_date,
        pickupTime: tripWithLocations.booking?.pickup_time,
        pickupLocation: tripDetails.from?.address || tripWithLocations.booking?.pickup_location?.address,
        dropoffLocation: tripDetails.to?.address || tripWithLocations.booking?.dropoff_location?.address,
        total_amount: tripWithLocations.booking?.total_amount || tripWithLocations.booking?.amount,
        booking_id: tripWithLocations.booking?.booking_id,
        booking_reference: tripWithLocations.booking?.booking_id,
        trip_details: tripDetails,
        tracking_url: tripWithLocations.booking?.tracking_url
      };
      
      console.log('Booking data prepared:', {
        bookingId: bookingData.bookingId,
        hasLocations: !!(bookingData.pickupLocation && bookingData.dropoffLocation)
      });
      
      // Send notifications based on status
      if (originalStatus === 'accepted') {
        console.log('🚀 Sending driver confirmation notifications...');
        
        // Send email
        if (customerEmail) {
          const emailResult = await sendDriverConfirmationEmail(customerEmail, customerName, bookingData, driverData);
          console.log('Email result:', emailResult);
        }
        
        // Send WhatsApp
        if (customerPhone && selectedVehicle) {
          console.log('📱 About to send WhatsApp confirmation. Phone:', customerPhone, 'Vehicle:', selectedVehicle.make, selectedVehicle.model);
          const vehicleInfo = `${selectedVehicle.make || ''} ${selectedVehicle.model || ''}`.trim() || 'Vehicle';
          const licensePlate = selectedVehicle.license_plate || 'TBA';
          const pickupDateTime = `${bookingData.pickupDate || ''} ${bookingData.pickupTime || ''}`.trim();
          
          const whatsappResult = await sendTripConfirmationNotification(
            customerPhone,
            customerName,
            driverData.full_name || 'Your Driver',
            vehicleInfo,
            licensePlate,
            pickupDateTime
          );
          console.log('WhatsApp result:', whatsappResult);
        } else {
          console.log('⚠️ WhatsApp not sent. Phone:', customerPhone, 'Vehicle:', !!selectedVehicle);
        }
        
      } else if (originalStatus === 'started' || dbStatus === 'in_progress') {
        console.log('🚀 Sending trip started notifications...');
        
        // Send WhatsApp notification for trip start
        if (customerPhone) {
          console.log('📱 About to send WhatsApp trip started. Phone:', customerPhone);
          const whatsappResult = await sendTripStartedNotification(
            customerPhone,
            customerName,
            driverData.full_name || 'Your Driver',
            driverData.phone || '',
            bookingData.tracking_url
          );
          console.log('WhatsApp result:', whatsappResult);
        } else {
          console.log('⚠️ WhatsApp trip started not sent. Phone:', customerPhone);
        }
        
      } else if (originalStatus === 'completed' || dbStatus === 'completed') {
        console.log('🚀 Sending trip completion notifications...');
        
        // Send email
        if (customerEmail) {
          const emailResult = await sendTripCompletionEmail(customerEmail, customerName, bookingData, driverData);
          console.log('Email result:', emailResult);
        }
        
        // Send WhatsApp
        if (customerPhone) {
          console.log('📱 About to send WhatsApp completion. Phone:', customerPhone);
          const totalAmount = bookingData.total_amount ? `R${parseFloat(bookingData.total_amount).toFixed(2)}` : undefined;
          const whatsappResult = await sendTripCompletedNotification(
            customerPhone,
            customerName,
            bookingData.dropoffLocation || 'Your destination',
            totalAmount
          );
          console.log('WhatsApp result:', whatsappResult);
        } else {
          console.log('⚠️ WhatsApp completion not sent. Phone:', customerPhone);
        }
        
      } else {
        console.log('ℹ️ No notifications sent for status:', status);
      }
    } catch (notificationError: any) {
      console.error('❌ Notification failed (non-blocking):', notificationError);
      console.error('Error details:', notificationError?.message, notificationError?.stack);
      // Don't throw - notification failure shouldn't block status update
    }
    
    return data;
  },

  // Accept assignment

  // Accept assignment
  async acceptAssignment(assignmentId: string, notes?: string) {
    return this.updateTripStatus(assignmentId, 'accepted', notes);
  },

  // Decline assignment
  async declineAssignment(assignmentId: string, reason?: string) {
    return this.updateTripStatus(assignmentId, 'declined', reason);
  },

  // Start trip
  async startTrip(assignmentId: string, notes?: string) {
    return this.updateTripStatus(assignmentId, 'started', notes);
  },

  // Complete trip
  async completeTrip(assignmentId: string, notes?: string) {
    return this.updateTripStatus(assignmentId, 'completed', notes);
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
  subscribeToTripUpdates(filterValue: string, callback: (payload: any) => void, filterBy: 'driver_id' | 'id' = 'driver_id') {
    const filter = filterBy === 'driver_id' ? `driver_id=eq.${filterValue}` : `id=eq.${filterValue}`;
    const channelName = filterBy === 'driver_id' ? 'driver-trip-updates' : `trip-update-${filterValue}`;
    
    return supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_assignments',
          filter: filter,
        },
        callback
      )
      .subscribe();
  },
};
