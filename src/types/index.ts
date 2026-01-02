// Database types
export interface Driver {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  license_number?: string;
  vehicle_type?: string;
  profile_image?: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  surname: string;
  email: string;
  cell: string;
  created_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  booking_type: 'shuttle' | 'transfer' | 'chauffeur';
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  number_of_passengers: number;
  vehicle_type: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  special_requests?: string;
  created_at: string;
  customer?: Customer;
}

export interface DriverAssignment {
  id: string;
  driver_id: string;
  booking_id: string;
  assigned_at: string;
  status: 'assigned' | 'accepted' | 'declined' | 'started' | 'completed';
  started_at?: string;
  completed_at?: string;
  notes?: string;
  driver?: Driver;
  booking?: Booking;
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
};

export type TabParamList = {
  Trips: undefined;
  History: undefined;
  Profile: undefined;
};

// Auth context types
export interface AuthContextType {
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
