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
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(location);

        // Sync location and rooms if user is logged in
        if (userId) {
          await syncLocationAndRooms(userId, location.coords.latitude, location.coords.longitude);
        }

        // Subscribe to location updates
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000, // Update every minute
            distanceInterval: 10, // Or every 10 meters
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
      await apiRequest('/rooms/sync', {
        method: 'POST',
        body: JSON.stringify({ userId, latitude, longitude }),
      });
    } catch (err) {
      console.error('Failed to sync location and rooms:', err);
    }
  }

  return { location, errorMsg };
}
