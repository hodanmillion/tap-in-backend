import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation } from '@/hooks/useLocation';
import { useEffect, useState, memo } from 'react';
import { MapPin, Users, ArrowRight, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';

const geocodeCache = new Map<string, string>();

function getTimeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return 'Permanent';
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

const RoomName = memo(({ room }: { room: any }) => {
  const [name, setName] = useState(room.name);
  const cacheKey = `${room.latitude?.toFixed(4)},${room.longitude?.toFixed(4)}`;

  useEffect(() => {
    async function resolveName() {
      if (room.type !== 'auto_generated' && room.name !== 'Ottawa Tech Hub') return;
      
      if (geocodeCache.has(cacheKey)) {
        setName(geocodeCache.get(cacheKey));
        return;
      }

      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: room.latitude,
          longitude: room.longitude
        });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const loc = reverseGeocode[0];
          const address = loc.street || loc.name || loc.city || 'Nearby Chat';
          geocodeCache.set(cacheKey, address);
          setName(address);
        }
      } catch (e) {
        console.log('Geocode failed', e);
      }
    }
    resolveName();
  }, [room.latitude, room.longitude, room.type, room.name, cacheKey]);

  return (
    <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
      {name}
    </Text>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
  const { location, errorMsg } = useLocation(user?.id);
  const router = useRouter();

  const { data: nearbyRooms, isLoading, refetch } = useQuery({
    queryKey: ['nearbyRooms', location?.coords.latitude, location?.coords.longitude],
    queryFn: async () => {
      if (!location) return [];
      const { latitude, longitude } = location.coords;
      const rooms = await apiRequest(`/rooms/nearby?lat=${latitude}&lng=${longitude}`);
      
      // Deduplicate by name and proximity (approx 10m)
      const uniqueRooms: any[] = [];
      for (const room of rooms) {
        const isDuplicate = uniqueRooms.some(r => {
          if (r.name === room.name) return true;
          if (room.latitude && room.longitude && r.latitude && r.longitude) {
            const dist = Math.sqrt(
              Math.pow(room.latitude - r.latitude, 2) + 
              Math.pow(room.longitude - r.longitude, 2)
            );
            // ~10m in degrees (very rough estimate, but okay for deduplication)
            return dist < 0.0001;
          }
          return false;
        });
        
        if (!isDuplicate) {
          uniqueRooms.push(room);
        }
      }
      
      return uniqueRooms.filter((r: any) => r.name !== 'Ottawa Tech Hub');
    },
    enabled: !!location,
    refetchInterval: 10000,
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Nearby Chats</Text>
          <View className="mt-2 flex-row items-center gap-1">
            <MapPin size={16} color="#6b7280" />
            <Text className="text-sm text-muted-foreground">
              {location ? '20m radius active' : errorMsg || 'Locating...'}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={nearbyRooms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item.id}`)}
                className="mb-4 flex-row items-center rounded-2xl bg-card p-4 shadow-sm"
              >
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Users size={24} color="#3b82f6" />
                </View>
                <View className="ml-4 flex-1">
                  <RoomName room={item} />
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color="#6b7280" />
                    <Text className="text-sm text-muted-foreground">
                      {getTimeRemaining(item.expires_at)}
                    </Text>
                  </View>
                </View>
                <ArrowRight size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center p-10">
                <Text className="text-center text-lg text-muted-foreground">
                  No active chats nearby.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Move around - a new chat will appear when you enter a new area!
                </Text>
              </View>
            }
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
