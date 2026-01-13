import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { driverService } from '../services/supabase';
import { Trip, RootStackParamList } from '../types';
import { LinearGradient } from 'expo-linear-gradient';
import TripCard from '../components/TripCard';


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TripsScreen = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { driver } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    if (driver) {
      loadTrips();
      setupRealtimeSubscription();
    }
  }, [driver]);

  // Reload trips when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (driver) {
        loadTrips();
      }
    }, [driver])
  );

  const loadTrips = async () => {
    try {
      if (!driver) return;
      
      // Filter by database statuses: assigned, confirmed, in_progress
      const data = await driverService.getDriverTrips(driver.id, 'assigned,confirmed,in_progress');
      setTrips(data as Trip[]);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load trips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!driver) return;

    // Subscribe to new trips
    const newTripsChannel = driverService.subscribeToNewTrips(driver.id, (payload) => {
      console.log('New trip assigned:', payload);
      Alert.alert('New Trip', 'You have been assigned a new trip!');
      loadTrips();
    });

    // Subscribe to trip updates
    const updatesChannel = driverService.subscribeToTripUpdates(driver.id, (payload) => {
      console.log('Trip updated:', payload);
      loadTrips();
    });

    return () => {
      newTripsChannel.unsubscribe();
      updatesChannel.unsubscribe();
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const handleTripPress = (tripId: string) => {
    navigation.navigate('TripDetail', { tripId });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#008080', '#00a896']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.greetingText}>Hello, {driver?.full_name?.split(' ')[0] || 'Driver'}</Text>
          <Text style={styles.headerTitle}>Your Trips</Text>
          {trips.length > 0 && (
            <View style={styles.tripCountContainer}>
              <View style={styles.tripCountBadge}>
                <Text style={styles.tripCountNumber}>{trips.length}</Text>
              </View>
              <Text style={styles.tripCountLabel}>Active</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {trips.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyText}>No active trips</Text>
          <Text style={styles.emptySubtext}>
            You'll be notified when new trips are assigned
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripCard trip={item} onPress={() => handleTripPress(item.id)} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    gap: 4,
  },
  greetingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  tripCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripCountBadge: {
    backgroundColor: '#ffffff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripCountNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#008080',
  },
  tripCountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
});

export default TripsScreen;
