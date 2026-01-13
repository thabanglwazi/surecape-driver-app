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
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);

      // Parse destination coordinates
      const destCoords = parseCoordinates(destination);
      
      if (destCoords) {
        // Fetch route from Google Directions API
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
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to start navigation');
    }
  };

  const parseCoordinates = (locationString: string): RouteCoordinates | null => {
    try {
      // Try to extract coordinates from string
      const coordsMatch = locationString.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      if (coordsMatch) {
        return {
          latitude: parseFloat(coordsMatch[1]),
          longitude: parseFloat(coordsMatch[2]),
        };
      }
      return null;
    } catch (error) {
      console.error('Error parsing coordinates:', error);
      return null;
    }
  };

  const fetchRoute = async (origin: RouteCoordinates, destination: RouteCoordinates) => {
    try {
      const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY'; // Replace with your API key from app.json
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
        
        // Set distance and duration
        const leg = route.legs[0];
        setDistance(leg.distance.text);
        setDuration(leg.duration.text);

        // Fit map to show entire route
        if (mapRef.current) {
          mapRef.current.fitToCoordinates([origin, destination], {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback: draw straight line
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

  if (!currentLocation || !destinationCoords) {
    return (
      <View style={styles.centered}>
        <Text>Loading navigation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
