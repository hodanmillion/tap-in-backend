import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Clock, ChevronRight, Hash, MessageSquare, Compass, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const ChatItemSkeleton = () => (
  <View className="mb-3 flex-row items-center rounded-3xl border border-border/50 bg-card p-4">
    <View className="h-14 w-14 rounded-2xl bg-secondary/80" />
    <View className="ml-4 flex-1 gap-2.5">
      <View className="h-4 w-36 rounded-lg bg-secondary/80" />
      <View className="h-3 w-24 rounded-lg bg-secondary/60" />
    </View>
    <View className="h-10 w-10 rounded-xl bg-secondary/60" />
  </View>
);

const ChatRoomItem = memo(
  ({
    item,
    theme,
    isOutOfRange,
    isExpired,
    onPress,
    index,
  }: {
    item: any;
    theme: any;
    isOutOfRange: boolean;
    isExpired: boolean;
    onPress: () => void;
    index: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        className="mb-3 flex-row items-center rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
        <View
          className={`h-14 w-14 items-center justify-center rounded-2xl overflow-hidden ${
            item.type === 'private' ? 'bg-primary/15' : 'bg-secondary/80'
          }`}>
          {item.type === 'private' ? (
            item.other_user_avatar ? (
              <Image 
                source={{ uri: item.other_user_avatar }} 
                style={{ width: 56, height: 56 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <MessageCircle size={24} color={theme.primary} />
            )
          ) : (
            <Hash size={24} color={theme.mutedForeground} />
          )}
        </View>
        <View className="ml-4 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-foreground flex-1 mr-2" numberOfLines={1}>
              {item.name}
            </Text>
            {(isOutOfRange || isExpired) && item.type !== 'private' && (
              <View className="flex-row items-center bg-secondary px-2 py-1 rounded-lg">
                <Lock size={10} color={theme.mutedForeground} />
                <Text className="ml-1 text-[9px] font-semibold text-muted-foreground">Read Only</Text>
              </View>
            )}
          </View>
          <View className="mt-1.5 flex-row items-center justify-between">
            <View className="flex-row items-center bg-secondary/60 px-2 py-0.5 rounded-md">
              <Clock size={10} color={theme.mutedForeground} />
              <Text className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Active'}
              </Text>
            </View>
            <View
              className={`px-2.5 py-1 rounded-lg ${item.type === 'private' ? 'bg-primary/15' : 'bg-secondary/80'}`}>
              <Text
                className={`text-[10px] font-bold ${item.type === 'private' ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.type === 'private' ? 'DM' : 'Group'}
              </Text>
            </View>
          </View>
        </View>
        <View className="ml-3 h-10 w-10 items-center justify-center rounded-xl bg-secondary/60">
          <ChevronRight size={18} color={theme.mutedForeground} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
);

export default function ChatsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { location } = useLocation(user?.id);

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

    const {
      data: rooms,
      isLoading,
      isFetching,
      refetch,
    } = useQuery({
      queryKey: ['myChatRooms', user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
  
        const { data: myParticipations, error: partError } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', user.id);
  
        if (partError) throw partError;
        if (!myParticipations || myParticipations.length === 0) return [];
  
        const roomIds = myParticipations.map(p => p.room_id);

        const { data: roomsData, error: roomsError } = await supabase
          .from('chat_rooms')
          .select(`
            *,
            room_participants(
              user_id,
              profiles(full_name, username, avatar_url)
            )
          `)
          .in('id', roomIds);
  
        if (roomsError) throw roomsError;
  
        return (roomsData || [])
          .map((room: any) => {
            if (room.type === 'private') {
              const otherParticipant = room.room_participants?.find(
                (p: any) => p.user_id !== user.id
              );
              const profile = otherParticipant?.profiles;
              return {
                ...room,
                name: profile?.full_name || `@${profile?.username}` || 'Private Chat',
                other_user_avatar: profile?.avatar_url,
              };
            }
            return room;
          })
          .sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
      },
      enabled: !!user?.id,
      staleTime: 60000 * 5,
      gcTime: 1000 * 60 * 20,
      placeholderData: (previousData) => previousData,
    });


  const renderRoom = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isOutOfRange =
        item.type !== 'private' &&
        location &&
        calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          item.latitude,
          item.longitude
        ) > (item.radius || 100);

      const isExpired = item.expires_at && new Date() > new Date(item.expires_at);

      return (
        <ChatRoomItem
          item={item}
          theme={theme}
          isOutOfRange={!!isOutOfRange}
          isExpired={!!isExpired}
          onPress={() => router.push(`/chat/${item.id}`)}
          index={index}
        />
      );
    },
    [location, theme, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
        <Animated.View entering={FadeInDown.springify()} className="mb-5 mt-4">
          <Text className="text-3xl font-black tracking-tight text-foreground">Messages</Text>
          <Text className="mt-2 text-sm font-medium text-muted-foreground">
            Your conversations
          </Text>
        </Animated.View>
  
        {isLoading && !rooms ? (
          <View className="flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <ChatItemSkeleton key={i} />
            ))}
          </View>
        ) : (
            <FlashList
              data={rooms}
              keyExtractor={(item) => item.id}
              onRefresh={refetch}
              refreshing={isFetching}
              renderItem={renderRoom}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              estimatedItemSize={85}
              ListEmptyComponent={
                !isFetching ? (
                  <Animated.View entering={FadeIn} className="mt-4 items-center justify-center rounded-3xl border border-border/50 bg-card p-8">
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                      <MessageSquare size={28} color={theme.mutedForeground} />
                    </View>
                    <Text className="text-center text-xl font-bold text-foreground">
                      No messages yet
                    </Text>
                    <Text className="mt-2 text-center text-sm text-muted-foreground px-4">
                      Start a conversation by joining a nearby zone!
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/home')}
                      activeOpacity={0.8}
                      className="mt-6 flex-row items-center gap-2 rounded-2xl bg-primary px-6 py-3.5">
                      <Compass size={18} color={theme.primaryForeground} />
                      <Text className="font-bold text-primary-foreground">
                        Explore Nearby
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null
              }
            />
          )}
        </View>
      </SafeAreaView>
    );
  }
