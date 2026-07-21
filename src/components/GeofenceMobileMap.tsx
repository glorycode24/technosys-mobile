import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { getDistance } from 'geolib';
import { Feather } from '@expo/vector-icons';

interface GeofenceMobileMapProps {
  userLat: number;
  userLng: number;
  branchLat: number;
  branchLng: number;
  radius: number;
  branchName: string;
}

export default function GeofenceMobileMap({
  userLat,
  userLng,
  branchLat,
  branchLng,
  radius,
  branchName
}: GeofenceMobileMapProps) {
  // If coordinates are invalid, show a placeholder
  if (!branchLat || !branchLng) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }]}>
        <Text style={{ color: '#64748b', fontSize: 12 }}>No location coordinates available</Text>
      </View>
    );
  }

  // Calculate distance
  const distance = getDistance(
    { latitude: userLat, longitude: userLng },
    { latitude: branchLat, longitude: branchLng }
  );
  const isInside = distance <= radius;

  // Format display text
  const displayDistance = distance >= 1000 
    ? `${(distance / 1000).toFixed(1)} km` 
    : `${Math.round(distance)} meters`;

  // Calculate Region to fit both branch and user, or just center on branch
  const mapRadius = Math.max(radius, distance) * 1.5;
  const delta = (mapRadius / 111000) * 2; // rough latitude delta to fit the bounds

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: branchLat,
          longitude: branchLng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        showsUserLocation={false} 
      >
        {/* Branch Marker */}
        <Marker
          coordinate={{ latitude: branchLat, longitude: branchLng }}
          title={branchName}
          description={`Radius: ${radius}m`}
        >
          <View style={styles.branchMarker}>
            <Feather name="home" size={14} color="#fff" />
          </View>
        </Marker>

        {/* Geofence Boundary */}
        <Circle
          center={{ latitude: branchLat, longitude: branchLng }}
          radius={radius}
          strokeWidth={2}
          strokeColor={isInside ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'}
          fillColor={isInside ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.05)'}
        />

        {/* User Marker */}
        {userLat && userLng ? (
          <Marker
            coordinate={{ latitude: userLat, longitude: userLng }}
            title="You"
            description={`Distance: ${displayDistance}`}
          >
            <View style={[styles.userMarkerGlow, { backgroundColor: isInside ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)' }]}>
              <View style={[styles.userMarker, { backgroundColor: isInside ? '#3b82f6' : '#ef4444' }]} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View style={styles.footerLabel}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.footerText}>
            📍 <Text style={{ fontWeight: 'bold' }}>{branchName}</Text>
          </Text>
          <Text style={[styles.statusText, { color: isInside ? '#10b981' : '#ef4444' }]}>
            {isInside ? '🟢 INSIDE' : '🔴 OUTSIDE'}
          </Text>
        </View>
        <Text style={styles.footerSubText}>
          Distance: {displayDistance} (Geofence: {radius}m)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0', 
    marginVertical: 12,
    backgroundColor: '#f8fafc'
  },
  map: {
    width: '100%',
    height: 195, 
  },
  branchMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userMarkerGlow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  footerLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  footerText: {
    color: '#334155',
    fontSize: 13,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  footerSubText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    marginLeft: 20, 
  }
});
