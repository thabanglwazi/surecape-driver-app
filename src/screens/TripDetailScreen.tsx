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
  }, [tripId]);

  const loadTripDetails = async () => {
    try {
      const data = await driverService.getTripById(tripId);
      setTrip(data);
    } catch (error: any) {
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
              await loadTripDetails();
              Alert.alert('Success', 'Trip status updated');
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
    if (trip?.booking?.customer?.cell) {
      Linking.openURL(`tel:${trip.booking.customer.cell}`);
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
  const customer = booking?.customer;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{trip.status.toUpperCase()}</Text>
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
          <Text style={styles.value}>{booking?.vehicle_type}</Text>
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
          <Text style={styles.locationText}>{booking?.pickup_location}</Text>
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => handleNavigate(booking?.pickup_location)}
          >
            <Text style={styles.navigateButtonText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>🏁 Drop-off</Text>
          <Text style={styles.locationText}>{booking?.dropoff_location}</Text>
          <TouchableOpacity
            style={styles.navigateButton}
            onPress={() => handleNavigate(booking?.dropoff_location)}
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
            {customer?.name} {customer?.surname}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>{customer?.cell}</Text>
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

        {trip.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => handleStatusUpdate('started')}
            disabled={updating}
          >
            <Text style={styles.actionButtonText}>Start Trip</Text>
          </TouchableOpacity>
        )}

        {trip.status === 'started' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleStatusUpdate('completed')}
            disabled={updating}
          >
            <Text style={styles.actionButtonText}>Complete Trip</Text>
          </TouchableOpacity>
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
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    backgroundColor: '#007AFF',
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
  acceptButton: {
    backgroundColor: '#34C759',
  },
  startButton: {
    backgroundColor: '#007AFF',
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
