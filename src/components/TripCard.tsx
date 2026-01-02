import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Trip } from '../types';

interface TripCardProps {
  trip: Trip | any;
  onPress?: () => void;
  isHistory?: boolean;
}

const TripCard: React.FC<TripCardProps> = ({ trip, onPress, isHistory }) => {
  const booking = trip.booking;
  const customer = booking?.customer;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return '#FF9500';
      case 'accepted':
        return '#007AFF';
      case 'started':
        return '#5856D6';
      case 'completed':
        return '#34C759';
      case 'declined':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <TouchableOpacity
      style={[styles.card, isHistory && styles.historyCard]}
      onPress={onPress}
      disabled={!onPress || isHistory}
    >
      <View style={styles.header}>
        <Text style={styles.bookingType}>{booking?.booking_type?.toUpperCase()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
          <Text style={styles.statusText}>{trip.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.locationSection}>
          <Text style={styles.locationLabel}>📍 Pickup</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {booking?.pickup_location}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.locationSection}>
          <Text style={styles.locationLabel}>🏁 Drop-off</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {booking?.dropoff_location}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Customer</Text>
          <Text style={styles.infoValue}>
            {customer?.name} {customer?.surname}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Date & Time</Text>
          <Text style={styles.infoValue}>
            {formatDate(booking?.pickup_date)} {booking?.pickup_time}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Passengers</Text>
          <Text style={styles.infoValue}>{booking?.number_of_passengers}</Text>
        </View>
      </View>

      {!isHistory && (
        <View style={styles.actionHint}>
          <Text style={styles.actionHintText}>Tap for details →</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyCard: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  bookingType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    marginBottom: 15,
  },
  locationSection: {
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionHint: {
    marginTop: 10,
    alignItems: 'center',
  },
  actionHintText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default TripCard;
