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
      
      // Filter by database statuses: assigned, confirmed (no in_transit status exists)
      const data = await driverService.getDriverTrips(driver.id, 'assigned,confirmed');
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
        colors={['#134e5e', '#71b280']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/surecape-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Active Trips</Text>
            <View style={styles.tripCountBadge}>
              <Text style={styles.tripCountText}>
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
              </Text>
            </View>
          </View>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  logo: {
    width: 45,
    height: 45,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tripCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tripCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
