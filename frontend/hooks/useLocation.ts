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
          // Check if the last known location is fresh (within 10 minutes)
          const isFresh = Date.now() - initialLocation.timestamp < 10 * 60 * 1000;
          
          if (isFresh) {
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
          } else {
            console.log('Last known location is stale, waiting for fresh coordinates...');
          }
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
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
            accuracy: Location.Accuracy.Highest,
            timeInterval: 5000, // 5 seconds (more frequent)
            distanceInterval: 5, // 5 meters (more sensitive)
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
                  const street = loc.street;
                  const streetNumber = loc.streetNumber;
                  const name = loc.name;
                  const city = loc.city || '';
                  
                  // Prioritize "Street Number + Street" for maximum clarity
                  if (street && street !== 'Unnamed Road') {
                    if (streetNumber) {
                      address = `${streetNumber} ${street}`;
                    } else {
                      address = street;
                    }
                  } else if (name && name !== 'Unnamed Road' && !name.includes('+')) {
                    address = name;
                  } else if (city) {
                    address = city;
                  }
                  
                  // Final cleanup: remove redundant suffixes or prefixes
                  if (address) {
                    // Remove common duplications like "Greenbank Rd, Greenbank Rd"
                    const parts = address.split(',').map(p => p.trim());
                    if (parts.length > 1 && parts[0] === parts[1]) {
                      address = parts[0];
                    } else if (parts.length > 1) {
                      address = parts[0];
                    }
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
