import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { apiRequest } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'last_known_location';
const LAST_SYNC_KEY = 'last_sync_data';
const MIN_DISTANCE_METERS = 25;
const MIN_SYNC_INTERVAL_MS = 20000;

type LastSyncData = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function useLocation(userId: string | undefined) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const locationRef = useRef<Location.LocationObject | null>(null);
  const lastUpdateRef = useRef<Location.LocationObject | null>(null);
  const lastSyncRef = useRef<LastSyncData | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const loadLastSync = async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
        if (stored) {
          lastSyncRef.current = JSON.parse(stored);
        }
      } catch {}
    };

    loadLastSync();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    (async () => {
      try {
        if (typeof window !== 'undefined' || Platform.OS !== 'web') {
          const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            setLocation(parsedCache);
            locationRef.current = parsedCache;
            lastUpdateRef.current = parsedCache;
          }
        }

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let initialLocation = await Location.getLastKnownPositionAsync();

        if (initialLocation) {
          setLocation(initialLocation);
          locationRef.current = initialLocation;
          lastUpdateRef.current = initialLocation;
          AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(initialLocation));
          if (userId) {
            maybeSyncLocation(
              userId,
              initialLocation.coords.latitude,
              initialLocation.coords.longitude
            );
          }
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation(currentPosition);
        locationRef.current = currentPosition;
        lastUpdateRef.current = currentPosition;
        AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(currentPosition));

        if (userId) {
          maybeSyncLocation(
            userId,
            currentPosition.coords.latitude,
            currentPosition.coords.longitude
          );
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000, // 10 seconds
            distanceInterval: 10, // 10 meters
          },
          (newLocation) => {
            // Always update ref for latest data
            locationRef.current = newLocation;

            // Only update state (trigger re-render) if moved significantly (> 10m)
            // or if it's been more than 20 seconds since last state update
            const shouldUpdateState = !lastUpdateRef.current || 
              haversineDistance(
                lastUpdateRef.current.coords.latitude, 
                lastUpdateRef.current.coords.longitude,
                newLocation.coords.latitude,
                newLocation.coords.longitude
              ) > 10 || 
              (newLocation.timestamp - lastUpdateRef.current.timestamp) > 20000;

            if (shouldUpdateState) {
              setLocation(newLocation);
              lastUpdateRef.current = newLocation;
            }

            if (userId && appStateRef.current === 'active') {
              maybeSyncLocation(
                userId,
                newLocation.coords.latitude,
                newLocation.coords.longitude
              );
            }
          }
        );
      } catch (err) {
        console.error('Error getting location:', err);
        setErrorMsg('Error getting location');
      }
    })();

    return () => {
      if (subscription) subscription.remove();
      appStateSub.remove();
    };
  }, [userId]);

  const maybeSyncLocation = async (uid: string, lat: number, lng: number) => {
    const now = Date.now();
    
    if (lastSyncRef.current) {
      const dist = haversineDistance(
        lastSyncRef.current.latitude,
        lastSyncRef.current.longitude,
        lat,
        lng
      );
      const timeDiff = now - lastSyncRef.current.timestamp;
      
      if (dist < MIN_DISTANCE_METERS && timeDiff < MIN_SYNC_INTERVAL_MS) {
        return;
      }
    }

    try {
        let address = '';
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (reverseGeocode && reverseGeocode.length > 0) {
            const loc = reverseGeocode[0];
            const street = loc.street || loc.name;
            const streetNumber = loc.streetNumber || '';
            const city = loc.city || '';
            const district = loc.district || '';
            
            if (street && street !== 'Unnamed Road' && street.toLowerCase() !== 'general room') {
              address = streetNumber ? `${streetNumber} ${street}` : street;
            } else if (district) {
              address = `${district}, ${city}`;
            } else if (city) {
              address = city;
            }
          }
        } catch (geocodeErr) {
        console.error('Reverse geocode failed in useLocation:', geocodeErr);
      }

      await apiRequest('/rooms/sync', {
        method: 'POST',
        body: JSON.stringify({ 
          userId: uid, 
          latitude: lat, 
          longitude: lng,
          address: address || undefined 
        }),
      });
      
      const syncData: LastSyncData = { latitude: lat, longitude: lng, timestamp: now };
      lastSyncRef.current = syncData;
      setLastSyncTime(now);
      AsyncStorage.setItem(LAST_SYNC_KEY, JSON.stringify(syncData));
    } catch (err) {
      console.error('Failed to sync location:', err);
    }
  };

  return { location, locationRef, errorMsg, lastSyncTime };
}
