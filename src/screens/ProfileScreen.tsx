import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const ProfileScreen = () => {
  const { driver, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    // For web, use confirm dialog instead of Alert.alert
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to sign out?')) {
        return;
      }
    } else {
      // For native, use Alert.alert
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => performSignOut(),
          },
        ]
      );
      return;
    }
    
    // If web and confirmed, perform sign out
    await performSignOut();
  };

  const performSignOut = async () => {
    setLoading(true);
    try {
      console.log('Signing out...');
      await signOut();
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      if (Platform.OS === 'web') {
        alert('Sign out failed: ' + message);
      } else {
        Alert.alert('Error', 'Failed to sign out: ' + message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!driver) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#134e5e', '#71b280']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {driver.full_name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{driver.full_name}</Text>
        <Text style={styles.email}>{driver.email}</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Driver Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.value}>{driver.phone || 'Not set'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>License Number</Text>
          <Text style={styles.value}>{driver.license_number || 'Not set'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, styles.statusActive]}>
            {driver.status === 'active' ? 'Active' : driver.status}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          SureCape Driver App v1.0.0{'\n'}
          © 2026 SureCape
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.signOutButton, loading && styles.signOutButtonDisabled]} 
        onPress={handleSignOut}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.signOutText}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  email: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
  statusActive: {
    color: '#34C759',
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    margin: 20,
    marginBottom: 40,
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ProfileScreen;
