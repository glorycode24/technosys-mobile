import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/timeout';

interface GeofenceResult {
  status: 'idle' | 'checking' | 'inside' | 'outside' | 'error';
  distance?: number | null; // meters from nearest office
  latitude?: number | null;
  longitude?: number | null;
  matchingOfficeName?: string | null;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  officeRadius?: number | null;
  error: string | null;
  errorKey?: string;
  isMocked?: boolean;
  gpsAccuracy?: number | null;
  timeDrift?: number | null;
}

export function useGeofence() {
  const [result, setResult] = useState<GeofenceResult>({
    status: 'idle', 
    distance: null, 
    latitude: null, 
    longitude: null, 
    matchingOfficeName: null,
    officeLatitude: null,
    officeLongitude: null,
    officeRadius: null,
    error: null,
    errorKey: undefined,
    isMocked: false,
    gpsAccuracy: null
  });

  const checkLocation = useCallback(async (): Promise<GeofenceResult> => {
    setResult(prev => ({ ...prev, status: 'checking', error: null }));

    try {
      // 1. Request permission with try-catch
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const errorMsg = 'Location permission denied. Please enable it in your phone settings.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'locationPermissionDenied' }));
        return { status: 'error', error: errorMsg, errorKey: 'locationPermissionDenied' } as const;
      }

      // 2. Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const isMocked = !!(location as any).mocked;
      const gpsAccuracy = location.coords.accuracy;

      // Time Tampering Detection (Check system clock against GPS satellite timestamp)
      const gpsTime = location.timestamp;
      const deviceTime = Date.now();
      const timeDelta = Math.abs(deviceTime - gpsTime);

      if (timeDelta > 5 * 60 * 1000) { // 5 minutes tolerance
        const errorMsg = 'Time manipulation detected. Please set your device clock to automatic network time.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'timeTamperingDetected' }));
        return { status: 'error', error: errorMsg, errorKey: 'timeTamperingDetected' } as const;
      }

      if (isMocked) {
        const errorMsg = 'Spoofing detected: Mock location provider active.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'mockLocationDetected' }));
        return { status: 'error', error: errorMsg, errorKey: 'mockLocationDetected' } as const;
      }

      if (gpsAccuracy && gpsAccuracy > 50) {
        const errorMsg = `Poor GPS signal accuracy (${Math.round(gpsAccuracy)}m). Please step outside or find an open space.`;
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'poorGpsSignal' }));
        return { status: 'error', error: errorMsg, errorKey: 'poorGpsSignal' } as const;
      }

      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      // 3. Fetch ALL active office locations from Supabase (with cache fallback)
      let offices: any[] = [];
      try {
        const fetchPromise = supabase
          .from('office_locations')
          .select('*')
          .eq('is_active', true);
        const { data, error: dbError } = await withTimeout(fetchPromise, 4000);
        
        if (dbError) throw dbError;
        
        if (data && data.length > 0) {
          offices = data;
          await AsyncStorage.setItem('CACHED_OFFICE_LOCATIONS', JSON.stringify(data));
        } else {
          throw new Error('No active office locations in database.');
        }
      } catch (err) {
        console.warn('DB geofence fetch failed. Loading cached locations...', err);
        const cached = await AsyncStorage.getItem('CACHED_OFFICE_LOCATIONS');
        if (cached) {
          offices = JSON.parse(cached);
        } else {
          const errorMsg = 'No office locations found in cache or database. Connect to network to download coordinates.';
          setResult(prev => ({ ...prev, status: 'error', error: errorMsg }));
          return { status: 'error', error: errorMsg } as const;
        }
      }

      // 4. Calculate distance to each and find if user is inside any
      let nearestOffice = null;
      let nearestDistance = Infinity;
      let isInsideAny = false;

      for (const office of offices) {
        const distanceMeters = getDistance(
          { latitude: userLat, longitude: userLng },
          { latitude: office.latitude, longitude: office.longitude }
        );

        if (distanceMeters <= office.radius_meters) {
          isInsideAny = true;
          nearestOffice = office;
          nearestDistance = distanceMeters;
          break; // Stop immediately since they are inside an allowed zone
        }

        if (distanceMeters < nearestDistance) {
          nearestDistance = distanceMeters;
          nearestOffice = office;
        }
      }

      // 5. Build final result
      if (isInsideAny && nearestOffice) {
        const finalResult: GeofenceResult = {
          status: 'inside',
          distance: nearestDistance,
          latitude: userLat,
          longitude: userLng,
          matchingOfficeName: nearestOffice.name,
          officeLatitude: nearestOffice.latitude,
          officeLongitude: nearestOffice.longitude,
          officeRadius: nearestOffice.radius_meters,
          error: null,
          isMocked,
          gpsAccuracy,
          timeDrift: timeDelta
        };
        setResult(finalResult);
        return finalResult;
      } else {
        const nearestName = nearestOffice ? nearestOffice.name : 'Office';
        const nearestRadius = nearestOffice ? nearestOffice.radius_meters : 50;
        const errorMsg = `You are ${nearestDistance}m away from the nearest branch (${nearestName}). You must be within ${nearestRadius}m to clock in.`;
        
        const finalResult: GeofenceResult = {
          status: 'outside',
          distance: nearestDistance,
          latitude: userLat,
          longitude: userLng,
          matchingOfficeName: nearestName,
          officeLatitude: nearestOffice ? nearestOffice.latitude : null,
          officeLongitude: nearestOffice ? nearestOffice.longitude : null,
          officeRadius: nearestRadius,
          error: errorMsg,
          isMocked,
          gpsAccuracy,
          timeDrift: timeDelta
        };
        setResult(finalResult);
        return finalResult;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to check location.';
      setResult(prev => ({ ...prev, status: 'error', error: errorMsg }));
      return { status: 'error', error: errorMsg } as const;
    }
  }, []);

  const reset = useCallback(() => {
    setResult({ 
      status: 'idle', 
      distance: null, 
      latitude: null, 
      longitude: null, 
      matchingOfficeName: null,
      officeLatitude: null,
      officeLongitude: null,
      officeRadius: null,
      error: null,
      errorKey: undefined,
      isMocked: false,
      gpsAccuracy: null
    });
  }, []);

  return { ...result, checkLocation, reset };
}
