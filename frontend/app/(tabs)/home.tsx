import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Users, ArrowRight, Clock, Bell, Plus, Compass } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

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

const RoomItemSkeleton = () => (
  <View className="mb-4 flex-row items-center rounded-3xl bg-card p-4 opacity-50 border border-border/50">
    <View className="h-14 w-14 rounded-2xl bg-secondary/60" />
    <View className="ml-4 flex-1 gap-2">
      <View className="h-4 w-32 rounded bg-secondary/60" />
      <View className="h-3 w-20 rounded bg-secondary/60" />
    </View>
    <View className="h-9 w-9 rounded-full bg-secondary/60" />
  </View>
);

const RoomItem = memo(({ item, onPress, theme }: { item: any; onPress: () => void; theme: any }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    className="mb-4 flex-row items-center rounded-3xl bg-card p-4 border border-border shadow-sm active:bg-secondary/10">
    <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
      <Users size={28} color={theme.primary} />
    </View>
    <View className="ml-4 flex-1">
      <Text className="text-lg font-bold text-foreground leading-tight" numberOfLines={1}>
        {item.name}
      </Text>
      <View className="flex-row items-center gap-1.5 mt-1">
        <Clock size={12} color={theme.mutedForeground} />
        <Text className="text-xs font-semibold text-muted-foreground">{getTimeRemaining(item.expires_at)}</Text>
      </View>
    </View>
    <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary/50">
      <ArrowRight size={18} color={theme.secondaryForeground} />
    </View>
  </TouchableOpacity>
));

export default function HomeScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const { location, errorMsg } = useLocation(user?.id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      return apiRequest(`/notifications/${user?.id}`);
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const {
    data: nearbyRooms,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'nearbyRooms',
      location?.coords.latitude.toFixed(4),
      location?.coords.longitude.toFixed(4),
    ],
    queryFn: async () => {
      if (!location) return [];
      const { latitude, longitude } = location.coords;
      return apiRequest(`/rooms/nearby?lat=${latitude}&lng=${longitude}`);
    },
    enabled: !!location,
    staleTime: 15000,
    gcTime: 1000 * 60 * 5,
    placeholderData: (previousData) => previousData,
  });

  const rooms = Array.from(new Map((nearbyRooms || []).map((item: any) => [item.id, item])).values());

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      if (!location) {
        Alert.alert('Location Required', 'We are still getting your location. Please wait a moment and try again.');
        return;
      }
      const { latitude, longitude } = location.coords;

      const isTooClose = rooms.some((room: any) => {
        const dist = getDistance(
          latitude,
          longitude,
          room.latitude,
          room.longitude
        );
        return dist < 20;
      });

      if (isTooClose) {
        throw new Error('A chat already exists within 20 meters of your location.');
      }

      return apiRequest('/rooms/create', {
        method: 'POST',
        body: JSON.stringify({
          name: `Nearby Chat (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
          latitude,
          longitude,
          radius: 20,
        }),
      });
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ['nearbyRooms'] });
      if (data.room) {
        router.push(`/chat/${data.room.id}`);
      }
    },
    onError: (error: any) => {
      Alert.alert('Stay Connected', error.message || 'Could not create chat room');
    },
  });

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
          <View className="mb-8 mt-6 flex-row items-center justify-between">
            <View>
              <View className="flex-row items-center">
                <Text className="text-3xl font-black tracking-tight text-foreground">Nearby</Text>
                <View className="ml-3 bg-primary px-2 py-0.5 rounded-md">
                  <Text className="text-[10px] font-black text-primary-foreground uppercase">Pro</Text>
                </View>
              </View>
              <View className="mt-1 flex-row items-center gap-2">

              <View className={`h-2 w-2 rounded-full ${location ? 'bg-green-500' : 'bg-amber-500 shadow-sm'}`} />
              <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {location ? 'Live Discovery' : errorMsg || 'Locating...'}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
              className="relative h-11 w-11 items-center justify-center rounded-xl bg-secondary/50 border border-border/50">
              <Bell size={22} color={theme.foreground} />
              {unreadCount > 0 && (
                <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary">
                  <Text className="text-[9px] font-black text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}
              className="h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
              <Plus size={24} color={theme.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => createRoomMutation.mutate()}
          disabled={createRoomMutation.isPending}
          activeOpacity={0.9}
          className={`mb-8 flex-row items-center justify-center gap-3 rounded-3xl bg-primary py-5 shadow-lg shadow-primary/25 ${
            createRoomMutation.isPending ? 'opacity-50' : ''
          }`}>
          {createRoomMutation.isPending ? (
            <ActivityIndicator color={theme.primaryForeground} size="small" />
          ) : (
            <>
              <Compass size={22} color={theme.primaryForeground} strokeWidth={2.5} />
              <Text className="text-lg font-bold text-primary-foreground tracking-tight">Drop a Pin & Chat</Text>
            </>
          )}
        </TouchableOpacity>

        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              Active Zones
            </Text>
            {isFetching && (
               <ActivityIndicator size="small" color={theme.primary} />
            )}
          </View>
          
            {isLoading && rooms.length === 0 ? (
              <View className="flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <RoomItemSkeleton key={i} />
                ))}
              </View>
              ) : (
                <FlatList
                  data={rooms as any[]}
                  keyExtractor={(item: any) => item.id}
                  renderItem={({ item }: { item: any }) => (
                    <RoomItem item={item} theme={theme} onPress={() => router.push(`/chat/${item.id}`)} />
                  )}
                ListEmptyComponent={
                  !isFetching ? (
                    <View className="mt-10 items-center justify-center p-12 rounded-[40px] border-2 border-dashed border-border/60 bg-secondary/50">
                      <View className="h-20 w-20 items-center justify-center rounded-full bg-background border border-border mb-6">
                        <Users size={40} color={theme.mutedForeground} opacity={0.4} />
                      </View>
                      <Text className="text-2xl font-black text-foreground text-center">
                        Quiet around here
                      </Text>
                      <Text className="mt-2 text-center text-base font-medium text-muted-foreground px-4">
                        Be the pioneer! Start a conversation and see who's nearby.
                      </Text>
                    </View>
                  ) : null
                }
                onRefresh={refetch}
                refreshing={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
              />
            )}
        </View>
      </View>
    </SafeAreaView>
  );
}
