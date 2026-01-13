import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Trip } from '../types';
import { Colors } from '../constants/theme';

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
        return Colors.statusAssigned;
      case 'confirmed':
        return Colors.statusConfirmed;
      case 'completed':
        return Colors.statusCompleted;
      case 'cancelled':
        return Colors.statusCancelled;
      default:
        return Colors.gray;
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'NEW';
      case 'confirmed':
        return 'ACCEPTED';
      case 'completed':
        return 'COMPLETED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return status.toUpperCase();
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
      activeOpacity={0.7}
    >
      {/* Status Badge at Top */}
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
        <Text style={styles.statusText}>{getStatusDisplay(trip.status)}</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Trip Route */}
        <View style={styles.routeContainer}>
          <View style={styles.routeIndicator}>
            <View style={styles.pickupDot} />
            <View style={styles.routeLine} />
            <View style={styles.dropoffDot} />
          </View>
          <View style={styles.routeDetails}>
            <View style={styles.locationRow}>
              <Text style={styles.locationText} numberOfLines={1}>
                {booking?.pickup_location?.address || booking?.pickup_location || 'Pickup location'}
              </Text>
            </View>
            
            {booking?.trip_details?.stops && booking.trip_details.stops.length > 0 && (
              booking.trip_details.stops.map((stop: any, index: number) => (
                <View key={index} style={styles.locationRow}>
                  <Text style={styles.stopText} numberOfLines={1}>
                    Stop {index + 1}: {stop?.address || stop || 'No address'}
                  </Text>
                </View>
              ))
            )}
            
            <View style={styles.locationRow}>
              <Text style={styles.locationText} numberOfLines={1}>
                {booking?.dropoff_location?.address || booking?.dropoff_location || 'Dropoff location'}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer & Time Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>👤</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {customer?.name} {customer?.surname}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🕐</Text>
            <Text style={styles.infoValue}>
              {booking?.pickup_time}
            </Text>
          </View>
        </View>

        {/* Bottom Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{booking?.booking_type?.toUpperCase()}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{booking?.number_of_passengers} PAX</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{formatDate(booking?.pickup_date)}</Text>
          </View>
        </View>
      </View>

      {!isHistory && (
        <View style={styles.chevronContainer}>
          <Text style={styles.chevron}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  historyCard: {
    opacity: 0.7,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: 16,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  routeIndicator: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 4,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#008080',
    marginBottom: 4,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4444',
    marginTop: 4,
  },
  routeDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationRow: {
    marginVertical: 4,
  },
  locationText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
    lineHeight: 20,
  },
  stopText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '400',
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#e0e0e0',
  },
  chevronContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  chevron: {
    fontSize: 32,
    color: '#d0d0d0',
    fontWeight: '300',
  },
});

export default TripCard;
