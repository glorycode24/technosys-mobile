import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';

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
  // Center map on the midpoint between user and branch, or focus on the user
  const initialRegion = {
    latitude: (userLat + branchLat) / 2,
    longitude: (userLng + branchLng) / 2,
    latitudeDelta: Math.abs(userLat - branchLat) * 2 + 0.005,
    longitudeDelta: Math.abs(userLng - branchLng) * 2 + 0.005,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {/* User Marker */}
        <Marker
          coordinate={{ latitude: userLat, longitude: userLng }}
          title="You"
          description="Your current location"
          pinColor="blue"
        />
        {/* Branch Marker */}
        <Marker
          coordinate={{ latitude: branchLat, longitude: branchLng }}
          title={branchName}
          description={`Geofence radius: ${radius}m`}
          pinColor="red"
        />
        {/* Geofence Circle */}
        <Circle
          center={{ latitude: branchLat, longitude: branchLng }}
          radius={radius}
          fillColor="rgba(16, 185, 129, 0.15)"
          strokeColor="#10b981"
          strokeWidth={2}
        />
      </MapView>
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
    marginVertical: 12
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
