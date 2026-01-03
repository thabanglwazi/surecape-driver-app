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
import { driverService } from '../services/supabase';
import { Trip, RootStackParamList } from '../types';

type TripDetailRouteProp = RouteProp<RootStackParamList, 'TripDetail'>;

const TripDetailScreen = () => {
  const route = useRoute<TripDetailRouteProp>();
  const navigation = useNavigation();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

  const handleNavigate = (location: string) => {
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${encodeURIComponent(location)}`
      : `google.navigation:q=${encodeURIComponent(location)}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open maps');
    });
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
        return 'ACCEPTED - IN PROGRESS';
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Booking Type:</Text>
          <Text style={styles.value}>{booking?.booking_type}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Passengers:</Text>
          <Text style={styles.value}>{booking?.number_of_passengers}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Vehicle:</Text>
          <Text style={styles.value}>
            {typeof booking?.vehicle_type === 'object' 
              ? booking?.vehicle_type?.name || 'N/A'
              : booking?.vehicle_type || 'N/A'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>License Plate:</Text>
          <Text style={[styles.value, !trip.selected_vehicles?.[0]?.license_plate && styles.warningText]}>
            {trip.selected_vehicles?.[0]?.license_plate || 
             trip.selected_vehicles?.[0]?.licensePlate ||
             trip.selected_vehicles?.[0]?.registration_number ||
             trip.selected_vehicles?.[0]?.registrationNumber ||
             trip.driver?.vehicle_info?.license_plate ||
             trip.driver?.vehicle_info?.licensePlate ||
             'Add vehicle via web app'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Date & Time:</Text>
          <Text style={styles.value}>
            {booking?.pickup_date} at {booking?.pickup_time}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Locations</Text>
        
        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>📍 Pickup</Text>
          <Text style={styles.locationText}>
            {booking?.pickup_location?.address || booking?.pickup_location || 'No pickup location'}
          </Text>
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => handleNavigate(booking?.pickup_location?.address || booking?.pickup_location)}
          >
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Display stops if they exist */}
        {booking?.trip_details?.stops && booking.trip_details.stops.length > 0 && (
          <>
            {booking.trip_details.stops.map((stop: any, index: number) => (
              <View key={index} style={styles.locationCard}>
                <Text style={styles.locationLabel}>🛑 Stop {index + 1}</Text>
                <Text style={styles.locationText}>
                  {stop?.address || stop || 'No address'}
                </Text>
                <TouchableOpacity
                  style={styles.navigateButton}
                  onPress={() => handleNavigate(stop?.address || stop)}
                >
                  <Text style={styles.navigateButtonText}>Navigate</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>🏁 Drop-off</Text>
          <Text style={styles.locationText}>
            {booking?.dropoff_location?.address || booking?.dropoff_location || 'No dropoff location'}
          </Text>
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => handleNavigate(booking?.dropoff_location?.address || booking?.dropoff_location)}
          >
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>
            {customer?.name} {customer?.surname || ''}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{customer?.email || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>{customer?.phone || customer?.cell}</Text>
        </View>
        <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
          <Text style={styles.callButtonText}>📞 Call Customer</Text>
        </TouchableOpacity>
      </View>

      {booking?.special_requests && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Requests</Text>
          <Text style={styles.specialRequests}>{booking.special_requests}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {trip.status === 'assigned' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleStatusUpdate('accepted')}
              disabled={updating}
            >
              <Text style={styles.actionButtonText}>Accept Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => handleStatusUpdate('declined')}
              disabled={updating}
            >
              <Text style={[styles.actionButtonText, styles.declineText]}>
                Decline
              </Text>
            </TouchableOpacity>
          </>
        )}

        {trip.status === 'confirmed' && (
          <>
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerText}>✓ Trip Accepted - Ready to Start</Text>
            </View>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleStatusUpdate('completed')}
              disabled={updating}
            >
              <Text style={styles.actionButtonText}>Complete Trip</Text>
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
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 16,
    color: '#666',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  locationCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  locationLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  navigateButton: {
    backgroundColor: '#008080',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  licensePlate: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 1,
  },
  warningText: {
    color: '#FF9500',
    fontStyle: 'italic',
    fontSize: 14,
  },
  specialRequests: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  actions: {
    padding: 20,
  },
  actionButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBanner: {
    backgroundColor: '#008080',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  statusBannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  declineButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  declineText: {
    color: '#FF3B30',
  },
});

export default TripDetailScreen;
