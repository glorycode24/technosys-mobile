import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Platform } from 'react-native';
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

  // Radar layout constants (centered in a 300x230 container)
  const width = 300;
  const height = 230;
  const cx = width / 2;
  const cy = height / 2;

  // Scale: we want the Geofence Circle to have a constant visual radius on the radar
  const geofenceVisualRadius = 65;

  // Scale mapping: 1 meter = (geofenceVisualRadius / radius) pixels
  const maxVisualDistance = 105;
  const rawPixelDistance = distance * (geofenceVisualRadius / radius);
  const pixelDistance = Math.min(rawPixelDistance, maxVisualDistance);

  // Set the angle of the user relative to the branch (-45 degrees for top-right quadrant)
  const angle = -Math.PI / 4; 
  const ux = Math.cos(angle) * pixelDistance;
  const uy = Math.sin(angle) * pixelDistance;

  // Format display text
  const displayDistance = distance >= 1000 
    ? `${(distance / 1000).toFixed(1)} km` 
    : `${Math.round(distance)} meters`;

  // Sweeper animation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      {/* Radar Console Area */}
      <View style={styles.radarConsole}>
        
        {/* Concentric rings */}
        <View style={[styles.ring, { width: 210, height: 210, borderRadius: 105, left: cx - 105, top: cy - 105, borderColor: '#1e293b' }]} />
        <View style={[styles.ring, { width: 170, height: 170, borderRadius: 85, left: cx - 85, top: cy - 85, borderColor: '#1e293b', borderStyle: 'dashed' }]} />
        <View style={[styles.ring, { width: 80, height: 80, borderRadius: 40, left: cx - 40, top: cy - 40, borderColor: '#1e293b', borderStyle: 'dashed' }]} />

        {/* Crosshairs */}
        <View style={[styles.crosshair, { width: 210, height: 1, left: cx - 105, top: cy }]} />
        <View style={[styles.crosshair, { width: 1, height: 210, left: cx, top: cy - 105 }]} />

        {/* Sweeping Radar Line */}
        <Animated.View 
          style={[
            styles.sweeper, 
            { 
              left: cx - 52.5, 
              top: cy - 0.75,
              transform: [
                { rotate: spin },
                { translateX: 52.5 }
              ] 
            }
          ]} 
        />

        {/* Geofence Boundary Circle */}
        <View 
          style={[
            styles.geofenceCircle, 
            { 
              width: geofenceVisualRadius * 2, 
              height: geofenceVisualRadius * 2, 
              borderRadius: geofenceVisualRadius,
              left: cx - geofenceVisualRadius,
              top: cy - geofenceVisualRadius,
              borderColor: isInside ? '#10b981' : '#ef4444',
              backgroundColor: isInside ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.03)',
              borderStyle: isInside ? 'solid' : 'dashed'
            }
          ]} 
        />

        {/* Proximity Connector Line */}
        {pixelDistance > 0 && (
          <View 
            style={[
              styles.connectorLine,
              {
                width: pixelDistance,
                left: cx + ux / 2 - pixelDistance / 2,
                top: cy + uy / 2 - 1,
                borderColor: isInside ? '#10b981' : '#ef4444',
                transform: [{ rotate: '-45deg' }]
              }
            ]}
          />
        )}

        {/* Central Branch Target Pin */}
        <View style={[styles.centerPin, { left: cx - 14, top: cy - 14, borderColor: isInside ? '#10b981' : '#64748b' }]}>
          <Feather name="home" size={12} color="#94a3b8" />
        </View>

        {/* User Location Node */}
        <View style={[styles.userNodeGlow, { left: cx + ux - 14, top: cy + uy - 14 }]} />
        <View style={[styles.userNode, { left: cx + ux - 5, top: cy + uy - 5 }]} />

        {/* Label Overlays */}
        <Text style={[styles.radarResolution, { left: 10, top: 10 }]}>RADAR RESOLUTION: 50m</Text>
        <Text style={[styles.boundaryStatus, { left: 10, top: 22, color: isInside ? '#10b981' : '#ef4444' }]}>
          {isInside ? "🟢 INSIDE BOUNDARY" : "🔴 OUTSIDE BOUNDARY"}
        </Text>
        
        {/* Center Target Info */}
        <Text style={[styles.targetInfo, { left: 0, right: 0, top: cy - 82 }]}>
          {branchName} ({radius}m)
        </Text>

        {/* Distance Indicator Box */}
        <View style={[styles.distanceBox, { left: cx + ux - 35, top: cy + uy + 8, borderColor: isInside ? '#10b981' : '#ef4444' }]}>
          <Text style={styles.distanceText}>{displayDistance}</Text>
        </View>

      </View>
      <View style={styles.footerLabel}>
        <Text style={styles.footerText}>
          🛰️ <Text style={{ fontWeight: 'bold' }}>TechnoSys Radar Map:</Text> Showing relative distance to {branchName} ({radius}m geofence).
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
    borderColor: '#1e293b',
    marginVertical: 12,
    backgroundColor: '#0b1329'
  },
  radarConsole: {
    width: '100%',
    height: 230,
    position: 'relative'
  },
  ring: {
    position: 'absolute',
    borderWidth: 1
  },
  crosshair: {
    position: 'absolute',
    backgroundColor: '#1e293b',
    opacity: 0.5
  },
  sweeper: {
    position: 'absolute',
    width: 105,
    height: 1.5,
    backgroundColor: '#10b981',
    opacity: 0.4
  },
  geofenceCircle: {
    position: 'absolute',
    borderWidth: 2
  },
  connectorLine: {
    position: 'absolute',
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 0.75,
    opacity: 0.8
  },
  centerPin: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  userNodeGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.25)'
  },
  userNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    borderWidth: 1.5,
    borderColor: '#ffffff'
  },
  radarResolution: {
    position: 'absolute',
    color: '#94a3b8',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  boundaryStatus: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: 'bold'
  },
  targetInfo: {
    position: 'absolute',
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  distanceBox: {
    position: 'absolute',
    width: 70,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#0f172a',
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  distanceText: {
    color: '#f8fafc',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold'
  },
  footerLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 9.5,
    textAlign: 'center'
  }
});
