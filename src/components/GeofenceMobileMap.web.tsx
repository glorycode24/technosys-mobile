import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }]}>
        <Text style={{ color: '#64748b', fontSize: 12 }}>No location coordinates available</Text>
      </View>
    );
  }

  // Use Google Maps embed API. It is highly compatible with browser CSP,
  // runs securely in all web containers (no unpkg CDN script blocks), and supports offline caching on mobile browsers.
  // If user location is available and valid, we show directions/route. Otherwise, center on the branch pin.
  const hasUserCoords = userLat && userLng && userLat !== 0 && userLng !== 0;
  
  const embedUrl = hasUserCoords
    ? `https://maps.google.com/maps?saddr=${userLat},${userLng}&daddr=${branchLat},${branchLng}&z=14&output=embed`
    : `https://maps.google.com/maps?q=${branchLat},${branchLng}&z=15&output=embed`;

  return (
    <View style={styles.container}>
      <iframe
        src={embedUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Geofence Map"
        allowFullScreen
        loading="lazy"
      />
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
});
