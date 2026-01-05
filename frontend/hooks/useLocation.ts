import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useLocation(userId: string | undefined) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);

      // Update location in database
      await updateProfileLocation(userId, location.coords.latitude, location.coords.longitude);

      // Subscribe to location updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // Update every minute
          distanceInterval: 10, // Or every 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
          updateProfileLocation(userId, newLocation.coords.latitude, newLocation.coords.longitude);
        }
      );

      return () => {
        subscription.remove();
      };
    })();
  }, [userId]);

  async function updateProfileLocation(id: string, lat: number, lng: number) {
    try {
      await supabase
        .from('profiles')
        .update({
          latitude: lat,
          longitude: lng,
          last_seen: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  }

  return { location, errorMsg };
}
