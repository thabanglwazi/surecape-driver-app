import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type NavigationRouteProp = RouteProp<RootStackParamList, 'Navigation'>;

const { width, height } = Dimensions.get('window');

interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

const NavigationScreen = () => {
  const route = useRoute<NavigationRouteProp>();
  const navigation = useNavigation();
  const { destination, destinationName } = route.params;
  
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinates[]>([]);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    startNavigation();
  }, []);

  const startNavigation = async () => {
    try {
      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for navigation');
        navigation.goBack();
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);

      // Parse destination coordinates
      const destCoords = parseCoordinates(destination);
      
      if (!destCoords) {
        Alert.alert(
          'Location Error', 
          'Could not parse destination coordinates. Make sure the location includes coordinates (e.g., "Address, -26.123, 28.456")',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Fetch route
      await fetchRoute(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        destCoords
      );

      // Start location tracking
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
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
      Alert.alert('Error', 'Failed to start navigation', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  const parseCoordinates = (locationString: string): RouteCoordinates | null => {
    try {
      // Try to extract coordinates from string (format: "lat,lng" or "address with lat,lng")
      const coordsMatch = locationString.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (coordsMatch) {
        return {
          latitude: parseFloat(coordsMatch[1]),
          longitude: parseFloat(coordsMatch[2]),
        };
      }
      
      // If no coordinates found, return null (will need geocoding or fallback)
      console.log('No coordinates found in:', locationString);
      return null;
    } catch (error) {
      console.error('Error parsing coordinates:', error);
      return null;
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
          <Text style={styles.loadingText}>Loading navigation...</Text>
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
            </View>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Back to Trip</Text>
            </TouchableOpacity>
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
});

export default NavigationScreen;
