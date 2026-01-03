# Quick Reference: Driver App ↔ Web App Integration

## 📊 Database Fields Mapping

### Driver Object
| Web App Field | Driver App Field | Type | Notes |
|--------------|------------------|------|-------|
| `phone` | `phone` | string | `+27XXXXXXXXX` format |
| `status` | `status` | enum | `'active'` \| `'inactive'` \| `'suspended'` |
| `vehicle_info` | `vehicle_info` | JSONB | Contains `{ vehicles: Vehicle[] }` |
| `full_name` | `full_name` | string | Driver's full name |
| `license_number` | `license_number` | string | Driver's license |

### Customer Object
| Web App Field | Driver App Field | Type | Notes |
|--------------|------------------|------|-------|
| `phone` | `phone` or `cell` | string | Both supported for compatibility |
| `name` | `name` | string | First name |
| `surname` | `surname` | string | Last name (optional) |
| `role` | `role` | enum | Can be `'driver'` for driver-customers |

### Booking Object
| Web App Field | Driver App Field | Type | Notes |
|--------------|------------------|------|-------|
| `booking_id` | `booking_id` | string | Human-readable "BOOK-001" |
| `total_amount` | `total_amount` | number | Use this, not `total_price` |
| `trip_details` | `trip_details` | JSONB | Additional trip info |
| `pickup_date` | `pickup_date` | string | Date in ISO format |
| `pickup_time` | `pickup_time` | string | Time in HH:MM format |

### Driver Assignment Object
| Web App Field | Driver App Field | Type | Notes |
|--------------|------------------|------|-------|
| `status` | `status` | enum | `assigned` → `accepted` → `started` → `completed` |
| `selected_vehicle_id` | `selected_vehicle_id` | UUID[] | Array of vehicle IDs |
| `started_at` | `started_at` | timestamp | Auto-set when status → `started` |
| `completed_at` | `completed_at` | timestamp | Auto-set when status → `completed` |

---

## 🔄 Status Flow

```
New Assignment
     ↓
  assigned ─────→ declined (rejected by driver)
     ↓
  accepted (driver confirms)
     ↓
  started (trip in progress)
     ↓
  completed (trip finished)
```

**Rules**:
- Can't skip from `assigned` → `started` (must accept first)
- Can't go back once `started`
- `declined` and `completed` are terminal states

---

## 🚗 Vehicle Structure

```typescript
// What's stored in database (drivers.vehicle_info)
{
  vehicles: [
    {
      id: "uuid-1",
      make: "Mercedes Benz",
      model: "Vito",
      year: 2020,
      color: "White",
      licensePlate: "CA 123-456",
      max_passengers: 7,
      max_large_bags: 6,
      max_small_bags: 4,
      vehicle_code: "MB_VITO_7S",
      trailer_eligible: true
    },
    {
      id: "uuid-2",
      make: "Hyundai",
      model: "H1",
      year: 2022,
      color: "Silver",
      licensePlate: "CA 789-012",
      max_passengers: 8,
      max_large_bags: 8,
      max_small_bags: 6,
      vehicle_code: "HY_H1_8S",
      trailer_eligible: false
    }
  ]
}
```

**In Assignment**:
```typescript
// Admin selects which vehicle(s) to use
assignment.selected_vehicle_id = ["uuid-1"]  // Driver uses first vehicle

// Driver app displays:
"Mercedes Benz Vito (2020) - CA 123-456"
```

---

## 📡 API Patterns

### Get Driver's Trips
```typescript
// Multiple statuses (active trips)
driverService.getDriverTrips(driverId, 'assigned,accepted,started')

// Single status (completed trips)
driverService.getDriverTrips(driverId, 'completed')

// All trips
driverService.getDriverTrips(driverId)
```

### Update Trip Status
```typescript
// Accept
await driverService.acceptAssignment(assignmentId, 'Ready to go!')

// Decline
await driverService.declineAssignment(assignmentId, 'Vehicle unavailable')

// Start
await driverService.startTrip(assignmentId, 'Picked up passenger')

// Complete
await driverService.completeTrip(assignmentId, 'Trip completed successfully')
```

### Get Trip Details
```typescript
const trip = await driverService.getTripById(assignmentId)

// Access selected vehicle
const vehicle = trip.selected_vehicles[0]
console.log(`Use: ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`)

// Access customer
const customer = trip.booking.customer
console.log(`Customer: ${customer.name}, Phone: ${customer.phone}`)
```

---

## 🔐 Authentication Flow

### 1. Send OTP
```typescript
const result = await signIn(phone)  // e.g., '+27695268777'
if (result?.needsOtp) {
  // Show OTP input screen
}
```

### 2. Verify OTP
```typescript
await signIn(phone, otpCode)  // e.g., '+27695268777', '123456'
// On success, driver object is set in context
```

### 3. Check Driver Status
```typescript
// AuthContext automatically:
// 1. Verifies OTP with Supabase Auth
// 2. Queries drivers table by phone
// 3. Checks status === 'active'
// 4. Sets driver in state
```

---

## 🔔 Real-Time Subscriptions

### New Trip Assignments
```typescript
const channel = driverService.subscribeToNewTrips(
  driver.id,
  (payload) => {
    // New trip assigned!
    showNotification('New trip assigned!')
    refreshTripList()
  }
)

// Clean up
channel.unsubscribe()
```

### Trip Updates
```typescript
const channel = driverService.subscribeToTripUpdates(
  driver.id,
  (payload) => {
    // Trip was updated (cancelled, modified, etc.)
    refreshTripDetails()
  }
)
```

---

## 🎨 UI Patterns

### Display Customer Name
```typescript
const displayName = customer.name && customer.surname
  ? `${customer.name} ${customer.surname}`
  : customer.name || 'Customer'
```

### Display Customer Phone
```typescript
const phone = customer.phone || customer.cell
// Always prefer 'phone' field
```

### Display Vehicle
```typescript
const vehicle = trip.selected_vehicles?.[0]
if (vehicle) {
  const display = `${vehicle.make} ${vehicle.model} (${vehicle.year})`
  const licensePlate = vehicle.licensePlate || vehicle.license_plate
}
```

### Display Booking Reference
```typescript
// Show human-readable ID
const reference = booking.booking_id || booking.id
// e.g., "BOOK-001" or fallback to UUID
```

### Display Trip Earnings
```typescript
const amount = booking.total_amount || booking.total_price
const display = `R${amount.toFixed(2)}`
```

---

## ⚠️ Common Pitfalls

### 1. Field Name Mismatches
❌ `driver.phone_number` → ✅ `driver.phone`
❌ `driver.is_active` → ✅ `driver.status === 'active'`
❌ `booking.total_price` → ✅ `booking.total_amount`
❌ `customer.cell` → ✅ `customer.phone` (or check both)

### 2. Status Flow Violations
❌ `assigned` → `started` (missing accept)
✅ `assigned` → `accepted` → `started`

### 3. Vehicle Access
❌ `driver.vehicle_type` (doesn't exist)
✅ `driver.vehicle_info.vehicles` (array of vehicles)

### 4. Phone Format
❌ `'0695268777'` (missing country code)
❌ `'27695268777'` (missing +)
✅ `'+27695268777'` (correct format)

---

## 🧪 Testing Checklist

- [ ] Login with phone number `+27695268777`
- [ ] View active trips (status: assigned, accepted, started)
- [ ] Accept a trip
- [ ] Start a trip
- [ ] Call customer from trip detail screen
- [ ] Navigate to pickup location
- [ ] Complete a trip
- [ ] View trip history (completed trips)
- [ ] Check vehicle details display correctly
- [ ] Test offline mode (cache trips locally)
- [ ] Verify real-time notifications
- [ ] Test with driver who has multiple vehicles

---

## 📚 Reference Documents

1. **WEB_APP_INTEGRATION_ANALYSIS.md** - Full architectural analysis
2. **INTEGRATION_SUMMARY.md** - What was done and next steps
3. **QUICK_REFERENCE.md** - This document (quick lookup)

---

## 🆘 Troubleshooting

### "Driver not found" on login
- Check phone format: must be `+27XXXXXXXXX`
- Verify driver exists in database
- Check `status = 'active'`

### Trips not loading
- Check driver_id matches authenticated driver
- Verify driver_assignments table has records
- Check status filter (don't filter by 'pending')

### Customer phone not showing
- Check both `customer.phone` and `customer.cell`
- Some records use different field names

### Vehicle not displaying
- Access via `driver.vehicle_info.vehicles` array
- Check `selected_vehicle_id` in assignment
- Fallback to first vehicle if none selected

### Real-time not working
- Verify Supabase Realtime is enabled in dashboard
- Check subscription filter matches driver_id
- Ensure channel is properly subscribed
- Test WebSocket connection (network tab)

---

**Last Updated**: January 2, 2026
**Status**: Integration Complete ✅
**Next Phase**: Implement critical features (accept/decline, vehicle display)
