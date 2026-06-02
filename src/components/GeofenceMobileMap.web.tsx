import React from 'react';
import { StyleSheet, View } from 'react-native';

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
  // Construct a Leaflet map embedded in srcDoc to run completely client-side in the browser
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .leaflet-popup-content {
          margin: 12px;
          font-size: 13px;
          color: #0f172a;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const centerLat = (${userLat} + ${branchLat}) / 2;
        const centerLng = (${userLng} + ${branchLng}) / 2;
        const map = L.map('map', { zoomControl: false }).setView([centerLat, centerLng], 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const userIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        });

        L.marker([${userLat}, ${userLng}], { icon: userIcon })
          .addTo(map)
          .bindPopup('<b>You</b><br>Your current GPS position')
          .openPopup();

        L.marker([${branchLat}, ${branchLng}])
          .addTo(map)
          .bindPopup('<b>${branchName}</b><br>Clock-in Geofence Target');

        L.circle([${branchLat}, ${branchLng}], {
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.15,
          radius: ${radius},
          weight: 2
        }).addTo(map);

        const bounds = L.latLngBounds([[${userLat}, ${userLng}], [${branchLat}, ${branchLng}]]);
        map.fitBounds(bounds, { padding: [40, 40] });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <iframe
        srcDoc={htmlContent}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Geofence Map"
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
    marginVertical: 12
  },
});
