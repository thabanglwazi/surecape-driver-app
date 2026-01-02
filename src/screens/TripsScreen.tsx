import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { driverService } from '../services/supabase';
import { Trip, RootStackParamList } from '../types';
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

  const loadTrips = async () => {
    try {
      if (!driver) return;
      
      const data = await driverService.getDriverTrips(driver.id, 'assigned,accepted,started');
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Active Trips</Text>
        <Text style={styles.headerSubtitle}>
          {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
        </Text>
      </View>

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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  list: {
    padding: 15,
  },
});

export default TripsScreen;
