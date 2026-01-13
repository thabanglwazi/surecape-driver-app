import React, { useEffect, useState } from 'react';
import {
  Platform,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { driverService, supabase } from '../services/supabase';
import { Trip, RootStackParamList } from '../types';
import { startLocationTracking } from '../services/locationService';
import { useAuth } from '../contexts/AuthContext';

type TripDetailRouteProp = RouteProp<RootStackParamList, 'TripDetail'>;

const TripDetailScreen = () => {
  const route = useRoute<TripDetailRouteProp>();
  const navigation = useNavigation();
  const { driver } = useAuth();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadTripDetails();
    
    // Setup real-time subscription for this specific trip
    const subscription = driverService.subscribeToTripUpdates(tripId, (payload) => {
      console.log('Trip detail updated in real-time:', payload);
      loadTripDetails();
    }, 'id');

    return () => {
      subscription.unsubscribe();
    };
  }, [tripId]);

  const loadTripDetails = async () => {
    try {
      const data = await driverService.getTripById(tripId);
      console.log('=== TRIP DETAIL DATA ===');
      console.log('Full trip data:', JSON.stringify(data, null, 2));
      console.log('Selected vehicle ID:', data?.selected_vehicle_id);
      console.log('Selected vehicles array:', data?.selected_vehicles);
      console.log('Driver vehicle_info:', data?.driver?.vehicle_info);
      console.log('Booking data:', data?.booking);
      console.log('Customer from table:', data?.booking?.customer);
      console.log('Customer from trip_details:', data?.booking?.trip_details?.customerInfo);
      const customerData = data?.booking?.trip_details?.customerInfo || data?.booking?.customer;
      console.log('Using customer data:', customerData);
      console.log('Customer name:', customerData?.name);
      console.log('Customer email:', customerData?.email);
      console.log('Customer phone:', customerData?.phone);
      setTrip(data);
    } catch (error: any) {
      console.error('Error loading trip details:', error);
      Alert.alert('Error', 'Failed to load trip details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    Alert.alert(
      'Confirm',
      `Are you sure you want to ${newStatus.replace('_', ' ')} this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              await driverService.updateTripStatus(tripId, newStatus);
              
              // Start location tracking when trip is accepted (status becomes 'confirmed' in DB)
              if ((newStatus === 'accepted' || newStatus === 'confirmed') && driver?.id) {
                console.log('🎯 Trip accepted - starting location tracking');
                await startLocationTracking(driver.id);
              }
              
              // If trip is completed or cancelled, navigate back to refresh the lists
              if (newStatus === 'completed' || newStatus === 'declined') {
                Alert.alert('Success', 'Trip status updated', [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } else {
                await loadTripDetails();
                Alert.alert('Success', 'Trip status updated');
              }
            } catch (error: any) {
              Alert.alert('Error', 'Failed to update status');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    const customerData = trip?.booking?.trip_details?.customerInfo || trip?.booking?.customer;
    const phone = customerData?.phone || customerData?.cell;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleNavigate = (location: string, locationName?: string) => {
    // Use in-app navigation instead of external maps
    navigation.navigate('Navigation' as never, { 
      destination: location,
      destinationName: locationName 
    } as never);
  };

  const startTrip = async () => {
    setStarting(true);
    
    try {
      const now = new Date().toISOString();
      console.log('🚗 Starting trip - Trip ID:', tripId);
      
      // Update assignment status to in_progress
      const { error: assignmentError } = await supabase
        .from('driver_assignments')
        .update({ 
          status: 'in_progress',
          started_at: now,
          updated_at: now
        })
        .eq('id', tripId);

      if (assignmentError) {
        console.error('❌ Assignment update error:', assignmentError);
        throw assignmentError;
      }

      // Update booking status to in_progress
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          status: 'in_progress',
          updated_at: now
        })
        .eq('id', trip.booking_id);

      if (bookingError) {
        console.error('❌ Booking update error:', bookingError);
        throw bookingError;
      }

      // Reload trip data
      await loadTripDetails();
      
      // Start location tracking when trip begins
      if (driver?.id) {
        console.log('🎯 Starting location tracking for trip');
        await startLocationTracking(driver.id);
      }
      
      Alert.alert('Success', '🚗 Trip started! Customer has been notified.');
      
    } catch (error: any) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip: ' + error.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centered}>
        <Text>Trip not found</Text>
      </View>
    );
  }

  const booking = trip.booking;
  // Customer data is stored in trip_details.customerInfo, not a separate table
  const customer = booking?.trip_details?.customerInfo || booking?.customer;

  const getStatusColor = () => {
    switch (trip.status) {
      case 'assigned':
        return '#FF9500';
      case 'confirmed':
        return '#008080';
      case 'in_progress':
        return '#2196F3';
      case 'completed':
        return '#34C759';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#666';
    }
  };

  const getStatusText = () => {
    switch (trip.status) {
      case 'assigned':
        return 'NEW TRIP';
      case 'confirmed':
        return 'ACCEPTED';
      case 'in_progress':
        return 'IN PROGRESS';
      case 'completed':
        return 'COMPLETED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return trip.status.toUpperCase();
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusHeaderText}>{getStatusText()}</Text>
      </View>

      {/* Route Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip Route</Text>
        <View style={styles.routeContainer}>
          <View style={styles.routeIndicator}>
            <View style={styles.pickupDot} />
            <View style={styles.routeLine} />
            <View style={styles.dropoffDot} />
          </View>
          <View style={styles.routeDetails}>
            <View style={styles.locationBlock}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <Text style={styles.locationText}>
                {booking?.pickup_location?.address || booking?.pickup_location || 'No pickup location'}
              </Text>
              <TouchableOpacity
                style={styles.navigateLink}
                onPress={() => handleNavigate(
                  booking?.pickup_location?.address || booking?.pickup_location,
                  'Pickup Location'
                )}
              >
                <Text style={styles.navigateLinkText}>🧭 Navigate</Text>
              </TouchableOpacity>
            </View>

            {booking?.trip_details?.stops && booking.trip_details.stops.length > 0 && (
              booking.trip_details.stops.map((stop: any, index: number) => (
                <View key={index} style={styles.locationBlock}>
                  <Text style={styles.locationLabel}>STOP {index + 1}</Text>
                  <Text style={styles.locationText}>
                    {stop?.address || stop || 'No address'}
                  </Text>
                  <TouchableOpacity
                    style={styles.navigateLink}
                    onPress={() => handleNavigate(
                      stop?.address || stop,
                      `Stop ${index + 1}`
                    )}
                  >
                    <Text style={styles.navigateLinkText}>🧭 Navigate</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={styles.locationBlock}>
              <Text style={styles.locationLabel}>DROP-OFF</Text>
              <Text style={styles.locationText}>
                {booking?.dropoff_location?.address || booking?.dropoff_location || 'No dropoff location'}
              </Text>
              <TouchableOpacity
                style={styles.navigateLink}
                onPress={() => handleNavigate(
                  booking?.dropoff_location?.address || booking?.dropoff_location,
                  'Drop-off Location'
                )}
              >
                <Text style={styles.navigateLinkText}>🧭 Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Customer Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer</Text>
        <View style={styles.customerInfo}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerInitials}>
              {customer?.name?.charAt(0)}{customer?.surname?.charAt(0)}
            </Text>
          </View>
          <View style={styles.customerDetails}>
            <Text style={styles.customerName}>
              {customer?.name} {customer?.surname || ''}
            </Text>
            <Text style={styles.customerEmail}>{customer?.email || 'N/A'}</Text>
            <Text style={styles.customerPhone}>{customer?.phone || customer?.cell}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
          <Text style={styles.callButtonText}>📞 Call Customer</Text>
        </TouchableOpacity>
      </View>

      {/* Trip Details Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip Details</Text>
        <View style={styles.detailsGrid}>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{booking?.booking_type}</Text>
          </View>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Passengers</Text>
            <Text style={styles.detailValue}>{booking?.number_of_passengers}</Text>
          </View>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue}>
              {typeof booking?.vehicle_type === 'object' 
                ? booking?.vehicle_type?.name || 'N/A'
                : booking?.vehicle_type || 'N/A'}
            </Text>
          </View>
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>License Plate</Text>
            <Text style={[styles.detailValue, !trip.selected_vehicles?.[0]?.license_plate && styles.warningText]}>
              {trip.selected_vehicles?.[0]?.license_plate || 
               trip.selected_vehicles?.[0]?.licensePlate ||
               trip.driver?.vehicle_info?.license_plate ||
               'Add via web'}
            </Text>
          </View>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>📅 Pickup Time</Text>
          <Text style={styles.timeValue}>
            {booking?.pickup_date} at {booking?.pickup_time}
          </Text>
        </View>
      </View>

      {booking?.special_requests && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Special Requests</Text>
          <Text style={styles.specialRequests}>{booking.special_requests}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {trip.status === 'assigned' && (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, styles.acceptButton]}
              onPress={() => handleStatusUpdate('accepted')}
              disabled={updating}
            >
              <Text style={styles.primaryButtonText}>✓ Accept Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton]}
              onPress={() => handleStatusUpdate('declined')}
              disabled={updating}
            >
              <Text style={styles.secondaryButtonText}>Decline</Text>
            </TouchableOpacity>
          </>
        )}

        {trip.status === 'confirmed' && (
          <>
            <View style={styles.readyBanner}>
              <Text style={styles.readyBannerText}>✓ Trip Accepted - Ready to Start</Text>
            </View>
            
            <TouchableOpacity
              style={[styles.primaryButton, styles.startButton, starting && styles.buttonDisabled]}
              onPress={startTrip}
              disabled={starting}
            >
              <Text style={styles.primaryButtonText}>
                {starting ? 'Starting Trip...' : '🚗 Confirm Pickup & Start Trip'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {trip.status === 'in_progress' && (
          <>
            <View style={styles.inProgressBanner}>
              <Text style={styles.inProgressBannerText}>🛣️ Trip In Progress</Text>
              {trip.started_at && (
                <Text style={styles.inProgressTime}>
                  Started: {new Date(trip.started_at).toLocaleTimeString()}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.primaryButton, styles.completeButton, updating && styles.buttonDisabled]}
              onPress={() => handleStatusUpdate('completed')}
              disabled={updating}
            >
              <Text style={styles.primaryButtonText}>
                {updating ? 'Completing Trip...' : '✅ Complete Trip'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  statusHeader: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  statusHeaderText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  routeContainer: {
    flexDirection: 'row',
  },
  routeIndicator: {
    width: 24,
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 8,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#008080',
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4444',
  },
  routeDetails: {
    flex: 1,
  },
  locationBlock: {
    marginVertical: 10,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
    marginBottom: 8,
  },
  navigateLink: {
    paddingVertical: 8,
  },
  navigateLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008080',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#008080',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customerInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  callButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginHorizontal: -6,
  },
  detailBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    margin: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  warningText: {
    color: '#FF9500',
    fontSize: 14,
  },
  timeBlock: {
    backgroundColor: '#f8f9fa',
    padding: 14,
    borderRadius: 12,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 6,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  specialRequests: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 24,
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  secondaryButtonText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '700',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  startButton: {
    backgroundColor: '#008080',
  },
  completeButton: {
    backgroundColor: '#FF9500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  readyBanner: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  readyBannerText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inProgressBanner: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  inProgressBannerText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  inProgressTime: {
    color: '#1976D2',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default TripDetailScreen;
