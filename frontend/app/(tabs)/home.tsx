import React, { memo, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { Bell, Radio, MapPin, ChevronRight, Settings, MessageCircle, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatRoomName } from '@/lib/utils';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

const RoomItemSkeleton = () => (
  <View className="mb-4">
    <View className="rounded-3xl border border-border/20 bg-card/40 p-5">
      <View className="flex-row items-center">
        <View className="h-14 w-14 rounded-2xl bg-secondary/40" />
        <View className="ml-4 flex-1 gap-2.5">
          <View className="h-4 w-44 rounded-lg bg-secondary/40" />
          <View className="h-3 w-16 rounded-lg bg-secondary/30" />
        </View>
        <View className="h-10 w-10 rounded-xl bg-secondary/30" />
      </View>
    </View>
  </View>
);

const RoomItem = memo(({ item, onPress, theme, index }: { item: any; onPress: () => void; theme: any; index: number }) => (
  <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, Active zone`}
      className="mb-4">
      <LinearGradient
        colors={['rgba(139,92,246,0.08)', 'rgba(124,58,237,0.04)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl border border-primary/10 p-4">
        <View className="flex-row items-center">
          <View className="min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-primary/15 p-3">
            <MapPin size={22} color={theme.primary} strokeWidth={2.5} />
          </View>
            <View className="ml-3 flex-1 shrink">
              <Text 
                className="text-base font-bold text-foreground tracking-tight" 
                numberOfLines={2}
                adjustsFontSizeToFit={false}
                allowFontScaling={true}>
                {formatRoomName(item.name)}
              </Text>

            <View className="flex-row items-center gap-1.5 mt-1">
              <View className="h-2 w-2 rounded-full bg-emerald-500" />
              <Text className="text-sm text-primary font-semibold" allowFontScaling={true}>Active</Text>
            </View>
          </View>
          <View className="min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-primary/10 ml-2">
            <ChevronRight size={20} color={theme.primary} strokeWidth={2.5} />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  </Animated.View>
));

export default function HomeScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
    const { location, errorMsg, lastSyncTime } = useLocation(user?.id);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
  
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
        lastSyncTime,
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

    const rooms = useMemo(() => {
      if (!location) return [];
      const { latitude, longitude } = location.coords;
      
      return (nearbyRooms || [])
        .map((room: any) => {
          const distance = calculateDistance(
            latitude,
            longitude,
            room.latitude,
            room.longitude
          );
          return { ...room, distanceMeters: distance };
        })
        .filter((room: any) => {
          // Only show rooms within their specified radius + 50m buffer
          const radius = room.radius || 500;
          return room.distanceMeters <= radius + 50;
        })
        .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
    }, [nearbyRooms, location]);

    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

  const handleRoomPress = (roomId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${roomId}`);
  };

  const handleStartChat = async () => {
    if (!location || !user?.id || isCreating) return;
    
    setIsCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const { latitude, longitude } = location.coords;
      
          let address = '';
          try {
            const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (reverseGeocode && reverseGeocode.length > 0) {
              const loc = reverseGeocode[0];
              const street = loc.street || loc.name;
              const streetNumber = loc.streetNumber || '';
              const city = loc.city || '';
              const district = loc.district || '';
              
              if (street && street !== 'Unnamed Road') {
                address = streetNumber ? `${streetNumber} ${street}` : street;
              } else if (district) {
                address = `${district}, ${city}`;
              } else if (city) {
                address = city;
              }
            }
          } catch {}

        if (!address) {
          address = `Chat Zone @ ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        }


      
      const result = await apiRequest('/rooms/create', {
        method: 'POST',
        body: JSON.stringify({
          name: address,
          latitude,
          longitude,
          radius: 500,
          userId: user.id,
        }),
      });
      
      queryClient.invalidateQueries({ queryKey: ['nearbyRooms'] });
      queryClient.invalidateQueries({ queryKey: ['myChatRooms'] });
      
      if (result.room?.id) {
        router.push(`/chat/${result.room.id}`);
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    } finally {
      setIsCreating(false);
    }
    };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1">
        <Animated.View entering={FadeInUp.springify()} className="px-5 pb-4 pt-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-3xl font-black text-foreground tracking-tight">TapIn</Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <View className={`h-2 w-2 rounded-full ${location ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <Text className="text-sm text-muted-foreground font-medium">
                    {location ? 'Live' : errorMsg || 'Locating...'}
                  </Text>
                </View>
              </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => router.push('/settings')}
                activeOpacity={0.7}
                className="h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border/30">
                <Settings size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                activeOpacity={0.7}
                className="relative h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border/30">
                <Bell size={18} color={theme.foreground} />
                {unreadCount > 0 && (
                  <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Text className="text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <View className="flex-1 px-5">
          {rooms.length > 0 && (
          <Animated.View entering={FadeInUp.springify()} className="flex-row items-center gap-2 mb-5 mt-1">
            <View className="flex-row items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
              <Radio size={14} color={theme.primary} strokeWidth={2.5} />
              <Text className="text-sm font-bold text-primary">
                {rooms.length} Active {rooms.length === 1 ? 'Zone' : 'Zones'}
              </Text>
            </View>
            {isFetching && <ActivityIndicator size="small" color={theme.primary} />}
          </Animated.View>
          )}
          
          {isError ? (
            <Animated.View entering={FadeIn} className="items-center justify-center py-24 px-8">
              <View className="h-24 w-24 items-center justify-center rounded-3xl bg-red-500/10 mb-6">
                <Radio size={36} color="#ef4444" strokeWidth={2} />
              </View>
              <Text className="text-xl font-bold text-foreground text-center">Connection Issue</Text>
              <Text className="mt-3 text-center text-base text-muted-foreground leading-6">
                {(error as Error)?.message || 'Unable to load nearby zones.'}
              </Text>
              <TouchableOpacity
                onPress={() => refetch()}
                activeOpacity={0.85}
                className="mt-6 px-8 py-3.5 rounded-full bg-primary">
                <Text className="text-base font-bold text-white">Retry</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : isLoading && rooms.length === 0 ? (
            <View className="flex-1 pt-4">
              {[1, 2, 3].map((i) => (
                <RoomItemSkeleton key={i} />
              ))}
            </View>
          ) : (
            <View className="flex-1">
              <FlashList
                data={rooms as any[]}
                keyExtractor={(item: any) => item.id}
                renderItem={({ item, index }: { item: any; index: number }) => (
                  <RoomItem item={item} theme={theme} index={index} onPress={() => handleRoomPress(item.id)} />
                )}
                ListEmptyComponent={
                  !isFetching ? (
                      <Animated.View entering={FadeIn} className="items-center justify-center py-32 px-8">
                        <View className="h-28 w-28 items-center justify-center rounded-full bg-primary/10 mb-6">
                          <MessageCircle size={48} color={theme.primary} strokeWidth={1.5} />
                        </View>
                        <Text className="text-2xl font-bold text-foreground text-center">No Active Zones</Text>
                        <Text className="mt-3 text-center text-base text-muted-foreground leading-7 max-w-[260px]">
                          Be the first to start a conversation in your area, or match with someone nearby
                        </Text>
                      </Animated.View>
                  ) : null
                }
                onRefresh={refetch}
                refreshing={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingTop: rooms.length === 0 ? 0 : 8 }}
              />
            </View>
          )}
        </View>

            <Animated.View entering={FadeInUp.delay(100).springify()} className="absolute bottom-8 left-6 right-6">
              <TouchableOpacity
                onPress={handleStartChat}
                disabled={isCreating}
                activeOpacity={0.9}
                className="shadow-2xl shadow-primary/40">
                <LinearGradient
                  colors={['#a78bfa', '#8b5cf6', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="h-16 items-center justify-center flex-row gap-3 rounded-[24px]">
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Zap size={24} color="#fff" fill="#fff" strokeWidth={3} />
                      <Text className="text-white text-lg font-black uppercase tracking-tighter">Send TapIn</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
      </View>
    </SafeAreaView>
  );
}
