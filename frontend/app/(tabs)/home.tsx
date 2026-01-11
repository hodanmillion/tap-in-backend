import React, { memo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Users, ArrowRight, Clock, Bell, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

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
  <View className="mb-4 flex-row items-center rounded-2xl bg-card p-4 opacity-50 shadow-sm">
    <View className="h-12 w-12 rounded-full bg-secondary" />
    <View className="ml-4 flex-1 gap-2">
      <View className="h-4 w-32 rounded bg-secondary" />
      <View className="h-3 w-20 rounded bg-secondary" />
    </View>
    <View className="h-5 w-5 rounded bg-secondary" />
  </View>
);

const RoomItem = memo(({ item, onPress }: { item: any; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    className="mb-4 flex-row items-center rounded-2xl bg-card p-4 shadow-sm active:opacity-70">
    <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
      <Users size={24} color="#3b82f6" />
    </View>
    <View className="ml-4 flex-1">
      <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
        {item.name}
      </Text>
      <View className="flex-row items-center gap-1">
        <Clock size={12} color="#6b7280" />
        <Text className="text-sm text-muted-foreground">{getTimeRemaining(item.expires_at)}</Text>
      </View>
    </View>
    <ArrowRight size={20} color="#6b7280" />
  </TouchableOpacity>
));

export default function HomeScreen() {
  const { user } = useAuth();
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

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error('Location not available');
      const { latitude, longitude } = location.coords;

      // Check if we already have a room within 20m in our local data to give instant feedback
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
      queryClient.invalidateQueries({ queryKey: ['nearbyRooms'] });
      if (data.room) {
        router.push(`/chat/${data.room.id}`);
      }
    },
    onError: (error: any) => {
      Alert.alert('Stay Connected', error.message || 'Could not create chat room');
    },
  });

  // Deduplicate rooms by ID and sort by distance if possible
  const rooms = Array.from(new Map((nearbyRooms || []).map((item: any) => [item.id, item])).values());

  // Helper to calculate distance in meters
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-foreground">Nearby Chats</Text>
            <View className="mt-2 flex-row items-center gap-1">
              <MapPin size={16} color="#6b7280" />
              <Text className="text-sm text-muted-foreground">
                {location ? 'Nearby chats active' : errorMsg || 'Locating...'}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => createRoomMutation.mutate()}
              disabled={createRoomMutation.isPending || !location}
              className={`h-12 w-12 items-center justify-center rounded-full bg-primary ${
                !location || createRoomMutation.isPending ? 'opacity-50' : ''
              }`}>
              {createRoomMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Plus size={24} color="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              className="relative h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Bell size={24} color="#3b82f6" />
              {unreadCount > 0 && (
                <View className="absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-red-500">
                  <Text className="text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => createRoomMutation.mutate()}
          disabled={createRoomMutation.isPending || !location}
          className={`mb-6 flex-row items-center justify-center gap-2 rounded-2xl bg-primary p-4 shadow-md active:opacity-90 ${
            !location || createRoomMutation.isPending ? 'opacity-50' : ''
          }`}>
          <Plus size={20} color="white" />
          <Text className="text-lg font-bold text-white">Create Chat Here</Text>
        </TouchableOpacity>

        {isLoading && rooms.length === 0 ? (
          <View className="flex-1">
            {[1, 2, 3, 4].map((i) => (
              <RoomItemSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RoomItem item={item} onPress={() => router.push(`/chat/${item.id}`)} />
            )}
            ListEmptyComponent={
              !isFetching ? (
                <View className="mt-10 items-center justify-center p-10">
                  <Text className="text-center text-lg text-muted-foreground">
                    No active chats nearby.
                  </Text>
                  <Text className="mt-2 text-center text-sm text-muted-foreground">
                    Click the button above to start a chat at your current location!
                  </Text>
                </View>
              ) : null
            }
            onRefresh={refetch}
            refreshing={isFetching && rooms.length > 0}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
