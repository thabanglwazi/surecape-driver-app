# SureCape Web App Integration Analysis

## Executive Summary

After analyzing the SureCape web application, here are the key findings and recommendations for building the driver mobile app:

---

## 1. Database Schema & Structure

### Drivers Table
```typescript
{
  id: UUID (primary key)
  full_name: string
  email: string
  phone: string  // Format: +27XXXXXXXXX (South African format)
  license_number: string (nullable)
  vehicle_info: JSONB  // Structure below
  status: 'active' | 'inactive' | 'suspended'
  notes: text (nullable)
  created_at: timestamp
  updated_at: timestamp
}
```

### Vehicle Info Structure (JSONB)
```typescript
{
  vehicles: [
    {
      id: UUID  // Unique ID for each vehicle
      make: string  // e.g., "Mercedes Benz"
      model: string  // e.g., "Vito"
      year: number  // e.g., 2020
      color: string
      licensePlate: string
      max_passengers: number
      max_large_bags: number
      max_small_bags: number
      vehicle_code: string  // References master vehicles table
      trailer_eligible: boolean
    }
  ]
}
```

### Driver Assignments Table
```typescript
{
  id: UUID (primary key)
  driver_id: UUID (foreign key → drivers)
  booking_id: UUID (foreign key → bookings)
  assigned_at: timestamp
  status: 'assigned' | 'accepted' | 'declined' | 'started' | 'completed'
  started_at: timestamp (nullable)
  completed_at: timestamp (nullable)
  notes: text (nullable)
  selected_vehicle_id: UUID[] (nullable)  // Which vehicle(s) from driver's fleet
}
```

### Bookings Table
```typescript
{
  id: UUID (primary key)
  booking_id: string  // Human-readable ID like "BOOK-001"
  booking_reference: string  // Public reference number
  customer_id: UUID (foreign key → customers)
  booking_type: 'shuttle' | 'transfer' | 'chauffeur'
  service_type: string
  pickup_location: string
  dropoff_location: string
  pickup_date: date
  pickup_time: time
  number_of_passengers: integer
  vehicle_type: string
  total_amount: decimal
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  special_requests: text (nullable)
  trip_details: JSONB  // Additional trip information
  created_at: timestamp
  updated_at: timestamp
}
```

### Customers Table
```typescript
{
  id: UUID (primary key)
  auth_user_id: UUID (foreign key → auth.users) (nullable for guests)
  name: string
  surname: string
  email: string (unique)
  phone: string
  is_guest: boolean
  role: 'customer' | 'admin' | 'driver'  // Note: Some customers can be drivers
  created_at: timestamp
  updated_at: timestamp
}
```

---

## 2. Authentication Patterns

### Web App Authentication Flow

1. **Multi-Role System**:
   - Customers, Admins, and Drivers all use the same auth system
   - Role is stored in `customers` table
   - `customer.role === 'driver'` indicates a driver account

2. **Session Management**:
   - Uses Supabase Auth with persistent sessions
   - Tracks session IDs across tabs (BroadcastChannel API)
   - Auto-logout on new login from different tab
   - 5-minute inactivity timeout

3. **Guest Support**:
   - Web app supports guest bookings without authentication
   - Guest customers have `is_guest: true`

### Driver App Authentication Approach

**Current Implementation**: OTP-based phone authentication
- ✅ Good: Simpler for drivers (no password management)
- ⚠️ Issue: Doesn't integrate with existing auth system
- 🔄 **Recommendation**: Use Supabase Auth phone OTP with proper driver table linking

**Recommended Flow**:
```typescript
1. Driver enters phone number (+27XXXXXXXXX)
2. Send OTP via Supabase Auth: supabase.auth.signInWithOtp({ phone })
3. Verify OTP: supabase.auth.verifyOtp({ phone, token, type: 'sms' })
4. On success:
   - Get auth user ID
   - Query drivers table by phone number
   - Check status === 'active'
   - Store driver session
```

---

## 3. Driver Management Logic

### Assignment Workflow (from web app)

1. **Admin assigns driver to booking**:
   ```javascript
   assignDriverToBooking(bookingId, driverId, notes, selectedVehicleIds)
   ```

2. **System automatically**:
   - Creates/updates `driver_assignments` record
   - Updates booking status to 'confirmed'
   - Sends notifications (WhatsApp, Email, SMS)
   - Notifies driver and customer

3. **Driver receives notification** (mobile app should listen for):
   - New trip assignment
   - Trip details (pickup, dropoff, customer info)
   - Selected vehicle(s) to use

4. **Driver actions** (mobile app must support):
   - Accept assignment → status: 'accepted'
   - Decline assignment → status: 'declined'
   - Start trip → status: 'started', set `started_at`
   - Complete trip → status: 'completed', set `completed_at`

### Vehicle Selection Logic

**Important**: Drivers can have multiple vehicles!

```typescript
// Web app checks which vehicles can handle the booking:
- Passenger capacity
- Luggage capacity (large bags, small bags)
- Trailer requirement
- Vehicle availability

// Admin selects specific vehicle(s) when assigning
// This is stored in assignment.selected_vehicle_id[]
```

**Driver App Should**:
- Display which vehicle(s) admin selected for the trip
- Allow driver to confirm vehicle availability
- Show vehicle details (make, model, license plate, year, color)

---

## 4. Real-Time Communication

### Realtime Subscriptions (Critical!)

Web app uses Supabase Realtime for:

1. **New Trip Assignments**:
   ```typescript
   supabase
     .channel('driver-trips')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'driver_assignments',
       filter: `driver_id=eq.${driverId}`
     }, callback)
     .subscribe()
   ```

2. **Trip Updates**:
   ```typescript
   supabase
     .channel('driver-trip-updates')
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'driver_assignments',
       filter: `driver_id=eq.${driverId}`
     }, callback)
     .subscribe()
   ```

3. **Booking Cancellations**:
   - Driver app should listen for booking status changes
   - Alert driver if trip is cancelled

**Recommended Implementation**:
- Keep persistent WebSocket connection
- Show push notifications for new assignments
- Auto-refresh trip list on updates
- Handle reconnection on network changes

---

## 5. Notification System

### Web App Sends Notifications Via:

1. **WhatsApp** (Primary):
   - Driver assignment details
   - Customer contact info
   - Trip updates

2. **Email** (Secondary):
   - Detailed trip information
   - Booking confirmation
   - Invoice/receipt

3. **SMS** (Fallback):
   - OTP codes
   - Critical alerts

### Driver App Should:

- **Receive**: Push notifications for new trips
- **Display**: In-app notifications for trip updates
- **Action**: One-tap call customer, navigate to location
- ❌ **Don't**: Send notifications (handled by web app backend)

---

## 6. Data Synchronization Strategy

### Critical Data Flow

```
1. Admin assigns driver (web app)
   ↓
2. Database updated
   ↓
3. Realtime event fired
   ↓
4. Driver app receives notification
   ↓
5. Driver accepts/declines
   ↓
6. Database updated
   ↓
7. Web app reflects status change
```

### Offline Handling

**Driver App Must Handle**:
- Network disconnections during trips
- Queue status updates locally
- Sync when connection restored
- Show offline indicator
- Cache trip details for offline viewing

### Recommended Approach:
```typescript
// Use optimistic UI updates
// Queue failed API calls
// Sync on reconnection
// Use AsyncStorage for offline cache
```

---

## 7. Key Differences: Web App vs Driver App

| Feature | Web App | Driver App |
|---------|---------|------------|
| **Authentication** | Email/password, social login | Phone OTP only |
| **User Role** | Customer, Admin, Driver | Driver only |
| **Primary Function** | Book trips, manage drivers | Accept/complete trips |
| **Notifications** | Sends notifications | Receives notifications |
| **Booking Creation** | ✅ Creates bookings | ❌ Views only |
| **Driver Assignment** | ✅ Admin assigns | ❌ Receives assignments |
| **Trip Status** | Views all statuses | Updates own trip statuses |
| **Vehicle Management** | ✅ Admin manages | ❌ Views assigned vehicle |
| **Customer Data** | Full access | Limited (phone, name only) |
| **Offline Support** | Not critical | Critical for in-trip updates |

---

## 8. Missing Features in Current Driver App

### Must-Have (Blocking Issues)

1. ❌ **Vehicle Display**: Not showing which vehicle to use
2. ❌ **Customer Phone**: Can't call customer easily
3. ❌ **Assignment Notes**: Missing admin notes for driver
4. ❌ **Booking Reference**: Not showing human-readable booking ID
5. ❌ **Proper Status Flow**: Missing 'accepted' and 'declined' states

### Should-Have (Important)

6. ❌ **Push Notifications**: No real push notification setup
7. ❌ **Offline Cache**: No offline trip viewing
8. ❌ **Trip Navigation**: Basic navigation, needs improvement
9. ❌ **Earnings Tracking**: No trip payment info
10. ❌ **Photo Upload**: Can't document trip completion

### Nice-to-Have (Future)

11. ⚠️ **Chat with Customer**: Direct messaging
12. ⚠️ **Route Optimization**: Multiple stops handling
13. ⚠️ **Expense Tracking**: Fuel, tolls, maintenance
14. ⚠️ **Performance Metrics**: Rating, on-time percentage

---

## 9. Security Considerations

### Row-Level Security (RLS)

Web app uses Supabase RLS policies:

1. **Drivers table**:
   - Authenticated users can read all drivers
   - Only admins can insert/update/delete

2. **Driver Assignments**:
   - Drivers can read their own assignments
   - Admins can manage all assignments
   - Drivers can update status of their own assignments

3. **Bookings**:
   - Customers can read their own bookings
   - Drivers can read bookings for their assignments
   - Admins can read all bookings

### Driver App Security

**Must Implement**:
```typescript
// 1. Verify driver access before showing data
const { data: driver } = await supabase
  .from('drivers')
  .select('*')
  .eq('phone', userPhone)
  .eq('status', 'active')
  .single()

// 2. Filter assignments by authenticated driver
const { data: trips } = await supabase
  .from('driver_assignments')
  .select('*, booking:bookings(*)')
  .eq('driver_id', driver.id)

// 3. Never expose sensitive customer data
// Only show: name, phone, pickup/dropoff
// Hide: email, payment details, full address
```

---

## 10. Recommended Architecture Updates

### Type Definitions (Update `src/types/index.ts`)

```typescript
// Match actual database schema
export interface Driver {
  id: string
  full_name: string
  email: string
  phone: string  // +27XXXXXXXXX format
  license_number?: string
  vehicle_info: VehicleInfo  // JSONB with vehicles array
  status: 'active' | 'inactive' | 'suspended'
  notes?: string
  created_at: string
  updated_at: string
}

export interface VehicleInfo {
  vehicles: Vehicle[]
}

export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  color: string
  licensePlate: string
  max_passengers: number
  max_large_bags: number
  max_small_bags: number
  vehicle_code: string
  trailer_eligible: boolean
}

export interface DriverAssignment {
  id: string
  driver_id: string
  booking_id: string
  assigned_at: string
  status: 'assigned' | 'accepted' | 'declined' | 'started' | 'completed'
  started_at?: string
  completed_at?: string
  notes?: string
  selected_vehicle_id?: string[]  // Array of vehicle IDs
  driver?: Driver
  booking?: Booking
}

export interface Booking {
  id: string
  booking_id: string  // Human-readable "BOOK-001"
  booking_reference: string
  customer_id: string
  booking_type: 'shuttle' | 'transfer' | 'chauffeur'
  service_type: string
  pickup_location: string
  dropoff_location: string
  pickup_date: string
  pickup_time: string
  number_of_passengers: number
  vehicle_type: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  special_requests?: string
  trip_details: any  // JSONB
  created_at: string
  updated_at: string
  customer?: Customer
}

export interface Customer {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  is_guest: boolean
  role: 'customer' | 'admin' | 'driver'
}
```

### Service Layer Updates

```typescript
// src/services/supabase.ts

// Add missing methods:

// Get driver with all vehicle details
async getDriverWithVehicles(driverId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single()
  
  if (error) throw error
  return {
    ...data,
    vehicles: data.vehicle_info?.vehicles || []
  }
}

// Get assignment with full details
async getAssignmentDetails(assignmentId: string) {
  const { data, error } = await supabase
    .from('driver_assignments')
    .select(`
      *,
      booking:bookings(
        *,
        customer:customers(name, surname, phone)
      ),
      driver:drivers(full_name, phone, vehicle_info)
    `)
    .eq('id', assignmentId)
    .single()
  
  if (error) throw error
  
  // Extract selected vehicle from driver's fleet
  const selectedVehicles = data.selected_vehicle_id
    ? data.driver.vehicle_info.vehicles.filter(v => 
        data.selected_vehicle_id.includes(v.id)
      )
    : []
  
  return {
    ...data,
    selected_vehicles: selectedVehicles
  }
}

// Accept assignment
async acceptAssignment(assignmentId: string) {
  return this.updateTripStatus(assignmentId, 'accepted')
}

// Decline assignment
async declineAssignment(assignmentId: string, reason?: string) {
  return this.updateTripStatus(assignmentId, 'declined', reason)
}
```

---

## 11. Implementation Priorities

### Phase 1: Critical Fixes (Week 1)

1. ✅ Fix authentication to use proper phone lookup
2. ✅ Update type definitions to match database
3. ✅ Add vehicle display in trip details
4. ✅ Implement accept/decline actions
5. ✅ Show customer phone with click-to-call

### Phase 2: Core Features (Week 2)

6. ✅ Set up real-time subscriptions
7. ✅ Add push notification handling
8. ✅ Implement offline caching
9. ✅ Add assignment notes display
10. ✅ Show booking reference numbers

### Phase 3: Enhancements (Week 3)

11. ✅ Improve navigation integration
12. ✅ Add trip earnings display
13. ✅ Implement photo upload
14. ✅ Add trip history filtering
15. ✅ Performance metrics dashboard

---

## 12. Testing Checklist

### Before Production Launch

- [ ] Test with multiple vehicles per driver
- [ ] Test accept/decline workflow
- [ ] Verify real-time notifications work
- [ ] Test offline mode (start trip offline)
- [ ] Verify customer data privacy
- [ ] Test with actual driver account
- [ ] Check navigation on Android & iOS
- [ ] Verify push notifications
- [ ] Test session persistence
- [ ] Load test with multiple concurrent drivers

---

## 13. Key Takeaways

1. **Database-Driven**: Everything syncs through Supabase - no local-only data
2. **Multi-Vehicle Support**: Drivers have multiple vehicles, admin selects which to use
3. **Real-Time Critical**: Must use Supabase Realtime for instant trip updates
4. **Status Flow**: assigned → accepted → started → completed (linear, no skipping)
5. **Phone Format**: Always +27XXXXXXXXX (South African standard)
6. **Security**: RLS policies restrict data access - respect them
7. **Offline-First**: Cache trip data for offline viewing during trips
8. **Integration**: Driver app is a consumer of web app's data, not a separate system

---

## 14. Next Steps

1. Review this document with team
2. Update type definitions
3. Implement missing features (Phases 1-3)
4. Test with real driver accounts
5. Deploy to production

**Questions?** Refer to web app codebase:
- `/src/services/driverService.js` - Driver management
- `/src/services/bookingService.js` - Booking creation
- `/src/utils/driverAssignmentRules.js` - Vehicle selection logic
- `/src/contexts/AuthContext.jsx` - Authentication patterns
