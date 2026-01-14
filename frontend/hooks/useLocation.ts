import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'last_known_location';

export function useLocation(userId: string | undefined) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        // 1. Try to load from persistent cache first (instant)
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

        // 2. Get OS-level last known position (fast)
        let initialLocation = await Location.getLastKnownPositionAsync();

        if (initialLocation) {
          setLocation(initialLocation);
          AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(initialLocation));
          if (userId) {
            syncLocationAndRooms(
              userId,
              initialLocation.coords.latitude,
              initialLocation.coords.longitude
            );
          }
        }

        // 3. Get fresh current position (most accurate)
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation(currentPosition);
        AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(currentPosition));

        if (
          userId &&
          (!initialLocation ||
            Math.abs(currentPosition.coords.latitude - initialLocation.coords.latitude) > 0.001 ||
            Math.abs(currentPosition.coords.longitude - initialLocation.coords.longitude) > 0.001)
        ) {
          syncLocationAndRooms(
            userId,
            currentPosition.coords.latitude,
            currentPosition.coords.longitude
          );
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 30000, // Sync every 30s
            distanceInterval: 10, // or 10 meters
          },
          (newLocation) => {
            setLocation(newLocation);
            const now = Date.now();
            // Throttle sync to once per 10 seconds to save battery and data
            if (userId && now - lastSyncRef.current > 10000) {
              lastSyncRef.current = now;
              syncLocationAndRooms(
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
    };
  }, [userId]);

  async function syncLocationAndRooms(userId: string, latitude: number, longitude: number) {
    try {
      // Fire and forget geocoding, don't let it block the sync
      let address: string | undefined;

      // We only attempt geocoding if we haven't done it recently or for room creation
      // In low reception, this might time out or fail, but we catch it.
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
      } catch (geoErr) {
        // Silently fail geocoding, backend will use coordinates as name
        console.log('Reverse geocode failed or timed out:', geoErr);
      }

      await apiRequest('/rooms/sync', {
        method: 'POST',
        body: JSON.stringify({ userId, latitude, longitude, address }),
      });
    } catch (err) {
      console.error('Failed to sync location and rooms:', err);
    }
  }

  return { location, errorMsg };
}
