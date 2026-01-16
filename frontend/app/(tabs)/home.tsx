import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Users, ArrowRight, Clock, Bell, Plus, Compass, WifiOff, RefreshCw, Sparkles, Radio } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';

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
  <View className="mb-3 flex-row items-center rounded-3xl bg-card p-4 border border-border/50">
    <View className="h-14 w-14 rounded-2xl bg-secondary/80" />
    <View className="ml-4 flex-1 gap-2.5">
      <View className="h-4 w-36 rounded-lg bg-secondary/80" />
      <View className="h-3 w-24 rounded-lg bg-secondary/60" />
    </View>
    <View className="h-10 w-10 rounded-xl bg-secondary/60" />
  </View>
);

const RoomItem = memo(({ item, onPress, theme, index }: { item: any; onPress: () => void; theme: any; index: number }) => (
  <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mb-3 flex-row items-center rounded-3xl bg-card p-4 border border-border/50 shadow-sm">
      <LinearGradient
        colors={[theme.primary + '25', theme.primary + '10']}
        className="h-14 w-14 items-center justify-center rounded-2xl"
      >
        <Users size={24} color={theme.primary} />
      </LinearGradient>
      <View className="ml-4 flex-1">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        <View className="flex-row items-center gap-2 mt-1.5">
          <View className="flex-row items-center gap-1 bg-secondary/60 px-2 py-0.5 rounded-md">
            <Clock size={10} color={theme.mutedForeground} />
            <Text className="text-[10px] font-semibold text-muted-foreground">{getTimeRemaining(item.expires_at)}</Text>
          </View>
        </View>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <ArrowRight size={18} color={theme.primary} />
      </View>
    </TouchableOpacity>
  </Animated.View>
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
      staleTime: 60000,
      gcTime: 1000 * 60 * 15,
    });
  
    const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;
  
    const {
      data: nearbyRooms,
      isLoading,
      isFetching,
      isError,
      error,
      refetch,
    } = useQuery({
      queryKey: [
        'nearbyRooms',
        location?.coords.latitude.toFixed(2),
        location?.coords.longitude.toFixed(2),
      ],
      queryFn: async () => {
        if (!location) return [];
        const { latitude, longitude } = location.coords;
        return apiRequest(`/rooms/nearby?lat=${latitude}&lng=${longitude}`);
      },
      enabled: !!location,
      staleTime: 60000 * 2,
      gcTime: 1000 * 60 * 15,
      placeholderData: (previousData) => previousData,
    });


  const rooms = useMemo(() => 
    Array.from(new Map((nearbyRooms || []).map((item: any) => [item.id, item])).values()),
    [nearbyRooms]
  );

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
            userId: user?.id,
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
          <Animated.View entering={FadeInUp.springify()} className="mb-5 mt-4 flex-row items-center justify-between">
            <View>
              <Text className="text-3xl font-black tracking-tight text-foreground">Nearby</Text>
              <View className="mt-2 flex-row items-center gap-2">
                <View className={`h-2.5 w-2.5 rounded-full ${location ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <Text className="text-sm font-medium text-muted-foreground">
                  {location ? 'Live' : errorMsg || 'Locating...'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
              className="relative h-12 w-12 items-center justify-center rounded-2xl bg-secondary/80 border border-border/50">
              <Bell size={22} color={theme.foreground} />
              {unreadCount > 0 && (
                <View className="absolute -right-1.5 -top-1.5 h-5.5 w-5.5 items-center justify-center rounded-full bg-primary border-2 border-background">
                  <Text className="text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <TouchableOpacity
              onPress={() => createRoomMutation.mutate()}
              disabled={createRoomMutation.isPending}
              activeOpacity={0.85}
              className="mb-6 overflow-hidden rounded-3xl shadow-lg shadow-primary/20">
              <LinearGradient
                colors={colorScheme === 'dark' ? ['#8b5cf6', '#6366f1'] : ['#7c3aed', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="flex-row items-center justify-center gap-3 py-5">
                {createRoomMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                      <Sparkles size={22} color="#fff" />
                    </View>
                    <Text className="text-lg font-bold text-white">Start a Chat Here</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Radio size={14} color={theme.primary} />
                <Text className="text-sm font-bold text-foreground">
                  Active Zones
                </Text>
              </View>
              {isFetching && (
                 <ActivityIndicator size="small" color={theme.primary} />
              )}
            </View>
            
              {isError ? (
                <Animated.View entering={FadeIn} className="mt-4 items-center justify-center p-8 rounded-3xl border border-destructive/20 bg-destructive/5">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl bg-background border border-border mb-4">
                    <WifiOff size={28} color={theme.destructive} />
                  </View>
                  <Text className="text-xl font-bold text-foreground text-center">
                    Connection Issue
                  </Text>
                  <Text className="mt-2 text-center text-sm text-muted-foreground px-4">
                    {(error as Error)?.message || 'Unable to load nearby zones.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => refetch()}
                    activeOpacity={0.8}
                    className="mt-5 flex-row items-center gap-2 rounded-2xl bg-primary px-6 py-3">
                    <RefreshCw size={16} color={theme.primaryForeground} />
                    <Text className="text-sm font-bold text-primary-foreground">Try Again</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : isLoading && rooms.length === 0 ? (
              <View className="flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <RoomItemSkeleton key={i} />
                ))}
              </View>
              ) : (
                  <View className="flex-1">
                    <FlashList
                      data={rooms as any[]}
                      keyExtractor={(item: any) => item.id}
                      renderItem={({ item, index }: { item: any; index: number }) => (
                        <RoomItem item={item} theme={theme} index={index} onPress={() => router.push(`/chat/${item.id}`)} />
                      )}
                      estimatedItemSize={80}
                      ListEmptyComponent={
                        !isFetching ? (
                          <Animated.View entering={FadeIn} className="mt-4 items-center justify-center p-8 rounded-3xl border border-border/50 bg-card">
                            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                              <Users size={28} color={theme.mutedForeground} />
                            </View>
                            <Text className="text-xl font-bold text-foreground text-center">
                              Quiet around here
                            </Text>
                            <Text className="mt-2 text-center text-sm text-muted-foreground px-4">
                              Be the first to start a conversation!
                            </Text>
                          </Animated.View>
                        ) : null
                      }
                      onRefresh={refetch}
                      refreshing={false}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 120 }}
                    />
                  </View>
              )}
          </View>
        </View>
      </SafeAreaView>
    );
  }
