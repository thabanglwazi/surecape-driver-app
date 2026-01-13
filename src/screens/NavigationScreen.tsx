import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import RNShake from 'react-native-shake';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';

type NavigationRouteProp = RouteProp<RootStackParamList, 'Navigation'>;

const { width, height } = Dimensions.get('window');
const ARRIVAL_THRESHOLD = 100; // meters

interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

const NavigationScreen = () => {
  const route = useRoute<NavigationRouteProp>();
  const navigation = useNavigation();
  const { destination, destinationName, tripId, nextDestination } = route.params;
  
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinates[]>([]);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [distanceToDestination, setDistanceToDestination] = useState<number>(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [trip, setTrip] = useState<any>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Debug logging function - logs to console and stores for mobile debugging
  const debugLog = (message: string, isError: boolean = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    setDebugLogs(prev => [...prev.slice(-4), logMessage]); // Keep last 5 logs
    
    // Show important errors as alerts on mobile
    if (isError) {
      Alert.alert('Debug Error', message);
    }
  };

  // Function to show debug info
  const showDebugInfo = () => {
    Alert.alert(
      'Debug Logs',
      debugLogs.join('\n\n') || 'No logs yet',
      [{ text: 'OK' }]
    );
  };

  useEffect(() => {
    // Set up shake listener for debug info
    RNShake.addListener(() => {
      showDebugInfo();
    });

    // Set a maximum timeout for initialization
    const initTimeout = setTimeout(() => {
      if (!currentLocation) {
        debugLog('Navigation initialization timed out after 20 seconds', true);
        Alert.alert(
          'Timeout',
          'Navigation is taking too long to load. Please check your internet connection and location services, then try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    }, 20000);

    startNavigation();
    if (tripId) {
      loadTripDetails();
    }
    
    return () => {
      RNShake.removeAllListeners();
      clearTimeout(initTimeout);
      // Clean up location subscription
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const loadTripDetails = async () => {
    if (!tripId) return;
    try {
      const { data, error } = await supabase
        .from('driver_assignments')
        .select(`
          *,
          booking:bookings(
            *,
            pickup_location,
            dropoff_location,
            trip_details
          )
        `)
        .eq('id', tripId)
        .single();
      
      if (error) throw error;
      setTrip(data);
    } catch (error) {
      console.error('Error loading trip:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const startNavigation = async () => {
    try {
      // Get current location
      setLoadingMessage('Checking permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for navigation');
        navigation.goBack();
        return;
      }

      debugLog('Getting current location...');
      setLoadingMessage('Getting your location...');
      
      let location = null;
      try {
        debugLog('Requesting location with 15s timeout');
        // Add timeout to location request (increased to 15 seconds)
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          maximumAge: 30000, // Accept location up to 30 seconds old
          timeout: 15000,
        });
        
        const timeoutPromise = new Promise<Location.LocationObject | null>((resolve) => {
          setTimeout(() => {
            debugLog('Location request timed out after 15s', true);
            resolve(null);
          }, 15000);
        });
        
        location = await Promise.race([locationPromise, timeoutPromise]);
        
        if (location) {
          debugLog(`Location obtained: ${location.coords.latitude}, ${location.coords.longitude}`);
        }
      } catch (locError) {
        debugLog(`Error getting location: ${locError}`, true);
        // Try with lower accuracy as fallback
        try {
          debugLog('Trying fallback with lower accuracy');
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
            maximumAge: 60000, // Accept location up to 1 minute old
            timeout: 10000,
          });
          if (location) {
            debugLog(`Fallback location obtained: ${location.coords.latitude}, ${location.coords.longitude}`);
          }
        } catch (fallbackError) {
          debugLog(`Fallback location also failed: ${fallbackError}`, true);
          location = null;
        }
      }
      
      if (!location) {
        Alert.alert(
          'Location Error',
          'Could not get your current location. Make sure location services are enabled and try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      console.log('Current location obtained:', location.coords);
      setCurrentLocation(location);

      // Parse destination coordinates
      setLoadingMessage('Finding destination...');
      debugLog(`Parsing destination: ${destination}`);
      let destCoords = parseCoordinates(destination);
      
      // If no coordinates found, try geocoding the address
      if (!destCoords) {
        debugLog('No coordinates found, attempting geocoding...');
        destCoords = await geocodeAddress(destination);
      }
      
      if (!destCoords) {
        debugLog('Both parsing and geocoding failed', true);
        Alert.alert(
          'Location Error', 
          `Could not find coordinates for: "${destination}"\n\nWould you like to:\n• Try external maps\n• Skip navigation and go back`,
          [
            { text: 'Skip Navigation', onPress: () => navigation.goBack() },
            { 
              text: 'Open External Maps', 
              onPress: () => {
                const url = Platform.OS === 'ios'
                  ? `maps://app?daddr=${encodeURIComponent(destination)}`
                  : `google.navigation:q=${encodeURIComponent(destination)}`;
                
                Linking.openURL(url).catch(() => {
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
                });
                navigation.goBack();
              }
            }
          ]
        );
        return;
      }
      
      console.log('Using coordinates:', destCoords);

      // Fetch route
      setLoadingMessage('Calculating route...');
      await fetchRoute(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        destCoords
      );
      setLoadingMessage('');

      // Start location tracking with arrival detection
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
          
          // Calculate distance to destination
          const distToDest = calculateDistance(
            newLocation.coords.latitude,
            newLocation.coords.longitude,
            destCoords.latitude,
            destCoords.longitude
          );
          setDistanceToDestination(distToDest);
          
          // Check if arrived (within 100 meters)
          if (distToDest <= ARRIVAL_THRESHOLD && !hasArrived) {
            setHasArrived(true);
          }
          
          // Update map camera to follow driver
          if (mapRef.current) {
            mapRef.current.animateCamera({
              center: {
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              },
              heading: newLocation.coords.heading || 0,
            });
          }
        }
      );
    } catch (error) {
      console.error('Navigation error:', error);
      setLoadingMessage('');
      Alert.alert(
        'Navigation Error', 
        `Failed to start navigation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const handleArrival = async () => {
    if (!tripId || !trip) {
      navigation.goBack();
      return;
    }

    try {
      if (nextDestination === 'pickup') {
        // At pickup - navigate to dropoff
        const dropoffLocation = trip.booking?.dropoff_location?.address || trip.booking?.dropoff_location;
        if (dropoffLocation) {
          navigation.replace('Navigation' as never, {
            destination: dropoffLocation,
            destinationName: 'Drop-off Location',
            tripId: tripId,
            nextDestination: 'dropoff'
          } as never);
        }
      } else if (nextDestination === 'dropoff') {
        // At dropoff - show complete trip button
        Alert.alert(
          'Arrived at Destination',
          'Complete this trip?',
          [
            { text: 'Not Yet', style: 'cancel' },
            {
              text: 'Complete Trip',
              onPress: async () => {
                await completeTrip();
              }
            }
          ]
        );
      } else {
        // Default - just go back
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error handling arrival:', error);
      Alert.alert('Error', 'Failed to proceed');
    }
  };

  const completeTrip = async () => {
    try {
      const now = new Date().toISOString();
      
      // Update assignment to completed
      const { error: assignmentError } = await supabase
        .from('driver_assignments')
        .update({
          status: 'completed',
          completed_at: now,
          updated_at: now
        })
        .eq('id', tripId);

      if (assignmentError) throw assignmentError;

      // Update booking to completed
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          updated_at: now
        })
        .eq('id', trip.booking_id);

      if (bookingError) throw bookingError;

      Alert.alert('Success', 'Trip completed successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('Main' as never);
          }
        }
      ]);
    } catch (error) {
      console.error('Error completing trip:', error);
      Alert.alert('Error', 'Failed to complete trip');
    }
  };

  const parseCoordinates = (locationString: string): RouteCoordinates | null => {
    try {
      debugLog(`Trying to parse coordinates from: "${locationString}"`);
      
      // Handle object-like strings (JSON)
      if (locationString.includes('{') || locationString.includes('lat') || locationString.includes('lng')) {
        try {
          const parsed = JSON.parse(locationString);
          if (parsed.lat && parsed.lng) {
            debugLog(`Found lat/lng in JSON: ${parsed.lat}, ${parsed.lng}`);
            return { latitude: parseFloat(parsed.lat), longitude: parseFloat(parsed.lng) };
          }
          if (parsed.latitude && parsed.longitude) {
            debugLog(`Found latitude/longitude in JSON: ${parsed.latitude}, ${parsed.longitude}`);
            return { latitude: parseFloat(parsed.latitude), longitude: parseFloat(parsed.longitude) };
          }
        } catch (e) {
          debugLog('Failed to parse as JSON, trying other methods');
        }
      }
      
      // Try to extract coordinates from string (format: "lat,lng" or "address with lat,lng")
      const coordsMatch = locationString.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (coordsMatch) {
        const lat = parseFloat(coordsMatch[1]);
        const lng = parseFloat(coordsMatch[2]);
        debugLog(`Found coordinates in string: ${lat}, ${lng}`);
        return { latitude: lat, longitude: lng };
      }
      
      // Check for common coordinate patterns like "lat: -26.123, lng: 28.456"
      const latLngMatch = locationString.match(/lat:\s*(-?\d+\.\d+).*?lng:\s*(-?\d+\.\d+)/);
      if (latLngMatch) {
        const lat = parseFloat(latLngMatch[1]);
        const lng = parseFloat(latLngMatch[2]);
        debugLog(`Found lat/lng pattern: ${lat}, ${lng}`);
        return { latitude: lat, longitude: lng };
      }
      
      // If no coordinates found, this will need geocoding
      debugLog('No coordinates found in string - will need geocoding');
      return null;
    } catch (error) {
      debugLog(`Error parsing coordinates: ${error}`, true);
      return null;
    }
  };

  const geocodeAddress = async (address: string): Promise<RouteCoordinates | null> => {
    try {
      setIsGeocoding(true);
      debugLog(`Starting geocoding for: "${address}"`);
      
      // Clean up the address for better geocoding
      const cleanAddress = address.replace(/[{}"]/g, '').trim();
      debugLog(`Cleaned address: "${cleanAddress}"`);
      
      // Add timeout (15 seconds for better chance of success)
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          debugLog('Geocoding timed out after 15s', true);
          resolve(null);
        }, 15000);
      });
      
      const geocodePromise = Location.geocodeAsync(cleanAddress);
      
      const geocoded = await Promise.race([geocodePromise, timeoutPromise]);
      
      if (geocoded && geocoded.length > 0) {
        debugLog(`Geocoding successful: ${geocoded[0].latitude}, ${geocoded[0].longitude}`);
        return {
          latitude: geocoded[0].latitude,
          longitude: geocoded[0].longitude,
        };
      }
      
      debugLog('Geocoding returned no results - trying alternative', true);
      
      // Try adding South Africa as fallback
      if (!cleanAddress.toLowerCase().includes('south africa')) {
        debugLog(`Trying geocoding with South Africa: "${cleanAddress}, South Africa"`);
        const saGeocode = await Location.geocodeAsync(`${cleanAddress}, South Africa`);
        if (saGeocode && saGeocode.length > 0) {
          debugLog(`SA geocoding successful: ${saGeocode[0].latitude}, ${saGeocode[0].longitude}`);
          return {
            latitude: saGeocode[0].latitude,
            longitude: saGeocode[0].longitude,
          };
        }
      }
      
      return null;
    } catch (error) {
      debugLog(`Geocoding error: ${error}`, true);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  const fetchRoute = async (origin: RouteCoordinates, destination: RouteCoordinates) => {
    try {
      // For now, just draw a straight line since we don't have Google API key
      // User needs to add their API key to app.json
      console.log('Drawing direct route from origin to destination');
      setRouteCoordinates([origin, destination]);
      
      // Calculate approximate distance (simplified)
      const R = 6371; // Earth radius in km
      const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
      const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(origin.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      setDistance(`${distance.toFixed(1)} km`);
      setDuration(`~${Math.ceil(distance * 2)} min`); // Rough estimate
      
      // Fit map to show entire route
      if (mapRef.current) {
        mapRef.current.fitToCoordinates([origin, destination], {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Still draw straight line as fallback
      setRouteCoordinates([origin, destination]);
    }
  };

  // Decode Google's polyline format
  const decodePolyline = (encoded: string): RouteCoordinates[] => {
    const points: RouteCoordinates[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  const destinationCoords = parseCoordinates(destination);

  return (
    <View style={styles.container}>
      {!currentLocation || !destinationCoords ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>
            {loadingMessage || (isGeocoding ? 'Finding location...' : 'Loading navigation...')}
          </Text>
          <Text style={styles.loadingSubtext}>
            {isGeocoding ? 'Converting address to coordinates' : 'This may take a few seconds'}
          </Text>
          <TouchableOpacity 
            style={[styles.cancelButton, { marginTop: 10 }]}
            onPress={showDebugInfo}
          >
            <Text style={styles.cancelButtonText}>Show Debug Info</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsTraffic={true}
            followsUserLocation={true}
          >
            {/* Destination Marker */}
            <Marker
              coordinate={destinationCoords}
              title={destinationName || 'Destination'}
              pinColor="#FF3B30"
            />

            {/* Route Polyline */}
            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeWidth={4}
                strokeColor="#008080"
              />
            )}
          </MapView>

          {/* Navigation Info Overlay */}
          <View style={styles.overlay}>
            <View style={styles.infoCard}>
              <Text style={styles.destinationText}>{destinationName || 'Destination'}</Text>
              {hasArrived ? (
                <View style={styles.arrivedContainer}>
                  <Text style={styles.arrivedText}>✓ You've Arrived!</Text>
                  <Text style={styles.arrivedSubtext}>Within {Math.round(distanceToDestination)}m</Text>
                </View>
              ) : (
                <>
                  {distance && duration && (
                    <View style={styles.statsRow}>
                      <View style={styles.stat}>
                        <Text style={styles.statLabel}>Distance</Text>
                        <Text style={styles.statValue}>{distance}</Text>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.stat}>
                        <Text style={styles.statLabel}>ETA</Text>
                        <Text style={styles.statValue}>{duration}</Text>
                      </View>
                    </View>
                  )}
                  {distanceToDestination > 0 && (
                    <Text style={styles.distanceText}>
                      {distanceToDestination < 1000 
                        ? `${Math.round(distanceToDestination)}m away`
                        : `${(distanceToDestination / 1000).toFixed(1)}km away`}
                    </Text>
                  )}
                </>
              )}
            </View>

            {hasArrived && tripId ? (
              <TouchableOpacity
                style={styles.arrivedButton}
                onPress={handleArrival}
              >
                <Text style={styles.arrivedButtonText}>
                  {nextDestination === 'pickup' ? '✓ Picked Up - Continue to Drop-off' : 
                   nextDestination === 'dropoff' ? '✓ Complete Trip' : 
                   '✓ Arrived'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>← Back to Trip</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#008080',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  map: {
    width: width,
    height: height,
  },
  overlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  destinationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#008080',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  backButton: {
    backgroundColor: '#008080',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  arrivedContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  arrivedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 4,
  },
  arrivedSubtext: {
    fontSize: 14,
    color: '#666',
  },
  arrivedButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  arrivedButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default NavigationScreen;
