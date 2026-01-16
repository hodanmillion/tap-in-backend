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
            timeInterval: 30000,
            distanceInterval: 15,
          },
          (newLocation) => {
            setLocation(newLocation);
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

  async function maybeSyncLocation(userId: string, latitude: number, longitude: number) {
    const now = Date.now();
    const last = lastSyncRef.current;

    if (last) {
      const timeSinceLastSync = now - last.timestamp;
      const distanceMoved = haversineDistance(last.latitude, last.longitude, latitude, longitude);

      if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS && distanceMoved < MIN_DISTANCE_METERS) {
        return;
      }
    }

    try {
      let address: string | undefined;
      try {
        const reverseGeocode = (await Promise.race([
          Location.reverseGeocodeAsync({ latitude, longitude }),
          new Promise((_, reject) => setTimeout(() => reject('Geocode timeout'), 3000)),
        ])) as Location.LocationGeocodedAddress[];

        if (reverseGeocode && reverseGeocode.length > 0) {
          const loc = reverseGeocode[0];
          const parts = [loc.street, loc.name, loc.city].filter(Boolean);
          address = parts.length > 0 ? parts.join(', ') : undefined;
        }
      } catch {}

      await apiRequest('/rooms/sync', {
        method: 'POST',
        body: JSON.stringify({ userId, latitude, longitude, address }),
      });

      const syncData: LastSyncData = { latitude, longitude, timestamp: now };
      lastSyncRef.current = syncData;
      AsyncStorage.setItem(LAST_SYNC_KEY, JSON.stringify(syncData));
    } catch (err) {
      console.error('Failed to sync location and rooms:', err);
    }
  }

  return { location, errorMsg };
}
