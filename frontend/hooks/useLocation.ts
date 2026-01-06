import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

export function useLocation(userId: string | undefined) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(location);

        if (userId) {
          await syncLocationAndRooms(userId, location.coords.latitude, location.coords.longitude);
        }

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 5,
          },
          (newLocation) => {
            setLocation(newLocation);
            if (userId) {
              syncLocationAndRooms(userId, newLocation.coords.latitude, newLocation.coords.longitude);
            }
          }
        );

        return () => {
          subscription.remove();
        };
      } catch (err) {
        console.error('Error getting location:', err);
        setErrorMsg('Error getting location');
      }
    })();
  }, [userId]);

  async function syncLocationAndRooms(userId: string, latitude: number, longitude: number) {
    try {
      let address: string | undefined;
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const loc = reverseGeocode[0];
          const parts = [loc.street, loc.name, loc.city].filter(Boolean);
          address = parts.length > 0 ? parts.join(', ') : undefined;
        }
      } catch (geoErr) {
        console.log('Reverse geocode failed:', geoErr);
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
