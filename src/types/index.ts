// Database types
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate?: string;
  license_plate?: string;
  max_passengers: number;
  max_large_bags: number;
  max_small_bags: number;
  vehicle_code?: string;
  trailer_eligible?: boolean;
}

export interface VehicleInfo {
  vehicles: Vehicle[];
}

export interface Driver {
  id: string;
  email: string;
  full_name: string;
  phone: string;  // Changed from phone_number to match DB
  license_number?: string;
  vehicle_info?: VehicleInfo;  // Changed from vehicle_type to match DB
  profile_image?: string;
  status: 'active' | 'inactive' | 'suspended';  // Changed from is_active
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  surname?: string;
  email: string;
  phone: string;
  cell?: string;
  is_guest?: boolean;
  role?: 'customer' | 'admin' | 'driver';
  created_at: string;
}

export interface Booking {
  id: string;
  booking_id?: string;
  booking_reference?: string;
  customer_id: string;
  booking_type: 'shuttle' | 'transfer' | 'chauffeur';
  service_type?: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  number_of_passengers: number;
  vehicle_type: string;
  total_amount: number;
  total_price?: number;
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  special_requests?: string;
  trip_details?: any;
  created_at: string;
  updated_at?: string;
  customer?: Customer;
}

export interface DriverAssignment {
  id: string;
  booking_id: string;
  driver_id: string;
  selected_vehicle_id?: string[];
  driver?: Driver;
  drivers?: Driver;
  booking?: Booking;
  bookings?: Booking;
  selected_vehicles?: Vehicle[];
  status: 'assigned' | 'accepted' | 'declined' | 'started' | 'completed';
  started_at?: string;
  completed_at?: string;
  notes?: string;
}

export interface Trip extends DriverAssignment {
  // Extended type combining assignment and booking data
  customer_name?: string;
  customer_phone?: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_datetime: string;
  passengers: number;
  vehicle_type: string;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  TripDetail: { tripId: string };
  Navigation: { 
    destination: string; 
    destinationName?: string;
    tripId?: string;
    nextDestination?: 'pickup' | 'dropoff' | 'complete';
  };
};

export type TabParamList = {
  Trips: undefined;
  History: undefined;
  Profile: undefined;
};

// User type
export interface User {
  id: string;
  email: string;
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  driver: Driver | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Notification types
export interface PushNotification {
  title: string;
  body: string;
  data?: {
    type: 'new_trip' | 'trip_update' | 'trip_cancelled';
    tripId?: string;
    bookingId?: string;
  };
}
