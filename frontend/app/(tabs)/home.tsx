import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation } from '@/hooks/useLocation';
import { useEffect, useState } from 'react';
import { MapPin, Users, ArrowRight, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';

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

export default function HomeScreen() {
  const [userId, setUserId] = useState<string | undefined>();
  const { location, errorMsg } = useLocation(userId);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  const { data: nearbyRooms, isLoading, refetch } = useQuery({
    queryKey: ['nearbyRooms', location?.coords.latitude, location?.coords.longitude],
    queryFn: async () => {
      if (!location) return [];
      const { latitude, longitude } = location.coords;
      return apiRequest(`/rooms/nearby?lat=${latitude}&lng=${longitude}`);
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
                    <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>

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
