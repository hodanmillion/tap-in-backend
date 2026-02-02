import * as Location from 'expo-location';
import { useEffect, useState, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { apiRequest } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'last_known_location';
const LAST_SYNC_KEY = 'last_sync_data';
const MIN_DISTANCE_METERS = 10;
const MIN_SYNC_INTERVAL_MS = 10000;

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
      let appStateSub: any = null;

      const loadLastSync = async () => {
        try {
          const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
          if (stored) {
            lastSyncRef.current = JSON.parse(stored);
          }
        } catch {}
      };

      loadLastSync();

      try {
        appStateSub = AppState.addEventListener('change', (nextState) => {
          appStateRef.current = nextState;
        });
      } catch (err) {
        console.error('Failed to add AppState listener:', err);
      }

      (async () => {
        try {
          if (typeof window !== 'undefined' || Platform.OS !== 'web') {
            try {
              const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
              if (cached) {
                const parsedCache = JSON.parse(cached);
                setLocation(parsedCache);
                locationRef.current = parsedCache;
                lastUpdateRef.current = parsedCache;
              }
            } catch (cacheErr) {
              console.warn('Failed to load cached location:', cacheErr);
            }
          }

          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied');
            return;
          }

          // Fast initial position check with Balanced accuracy
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).then(pos => {
            if (pos) {
              setLocation(pos);
              locationRef.current = pos;
              lastUpdateRef.current = pos;
              AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(pos)).catch(() => {});
              if (userId) {
                maybeSyncLocation(userId, pos.coords.latitude, pos.coords.longitude);
              }
            }
          }).catch(err => console.log('Fast location check failed:', err));

          try {
            let initialLocation = await Location.getLastKnownPositionAsync();
            if (initialLocation) {
              setLocation(initialLocation);
              locationRef.current = initialLocation;
              lastUpdateRef.current = initialLocation;
              AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(initialLocation)).catch(() => {});

              if (userId) {
                maybeSyncLocation(
                  userId,
                  initialLocation.coords.latitude,
                  initialLocation.coords.longitude
                );
              }
            }
          } catch (lastKnownErr) {
            console.log('Get last known position error:', lastKnownErr);
          }

          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (newLocation) => {
                // Always update ref for latest data
                locationRef.current = newLocation;

                // Only update state (trigger re-render) if moved slightly (> 2m)
                // or if it's been more than 5 seconds since last state update
                const shouldUpdateState = !lastUpdateRef.current || 
                  haversineDistance(
                    lastUpdateRef.current.coords.latitude, 
                    lastUpdateRef.current.coords.longitude,
                    newLocation.coords.latitude,
                    newLocation.coords.longitude
                  ) > 2 || 
                  (newLocation.timestamp - lastUpdateRef.current.timestamp) > 5000;

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
        try {
          if (subscription && typeof subscription.remove === 'function') {
            subscription.remove();
          }
        } catch {}
        try {
          if (appStateSub && typeof appStateSub.remove === 'function') {
            appStateSub.remove();
          }
        } catch {}
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

  return { location, locationRef, errorMsg, lastSyncTime, refreshLocation: async () => {
    try {
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      locationRef.current = fresh;
      setLocation(fresh);
      return fresh;
    } catch (e) {
      console.error('Failed to refresh location:', e);
      return locationRef.current;
    }
  }};
}
