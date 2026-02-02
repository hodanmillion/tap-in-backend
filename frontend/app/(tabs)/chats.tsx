import React, { memo, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Clock, ChevronRight, Hash, MessageSquare, Compass, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { apiRequest } from '@/lib/api';
import { formatRoomName } from '@/lib/utils';

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
    onPress,
    index,
  }: {
    item: any;
    theme: any;
    onPress: () => void;
    index: number;
  }) => {
    const isReadOnly = item.type !== 'private' && item.read_only_reason;
    
    return (
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
                  {formatRoomName(item.name)}
                </Text>
                {isReadOnly && (

                <View className="flex-row items-center bg-secondary px-2 py-1 rounded-lg">
                  <Lock size={10} color={theme.mutedForeground} />
                  <Text className="ml-1 text-[9px] font-semibold text-muted-foreground" numberOfLines={1}>
                    {item.read_only_reason}
                  </Text>
                </View>
              )}
            </View>
              <View className="mt-1.5 flex-row items-center justify-between">
                {item.last_message_preview ? (
                  <Text className="text-[11px] text-muted-foreground flex-1 mr-2" numberOfLines={1}>
                    {item.last_message_preview}
                  </Text>
                ) : isReadOnly ? (
                  <View className="flex-row items-center bg-secondary/60 px-2 py-0.5 rounded-md">
                    <Clock size={10} color={theme.mutedForeground} />
                    <Text className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                      {item.last_message_at 
                        ? new Date(item.last_message_at).toLocaleDateString() 
                        : item.created_at 
                          ? new Date(item.created_at).toLocaleDateString() 
                          : 'Inactive'}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-[11px] text-muted-foreground">
                    No messages yet
                  </Text>
                )}
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
    );
  }
);

export default function ChatsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { location } = useLocation(user?.id);
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);
  const invalidationThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: roomsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['myChatRooms', user?.id, location?.coords?.latitude?.toFixed(2), location?.coords?.longitude?.toFixed(2)],
    queryFn: async () => {
      if (!user?.id) return [];

      const lat = location?.coords?.latitude || 0;
      const lng = location?.coords?.longitude || 0;
      
      const data = await apiRequest(`/rooms/user-rooms?userId=${user.id}&lat=${lat}&lng=${lng}`);
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30000,
    gcTime: 1000 * 60 * 20,
    refetchOnMount: 'always',
  });

  const rooms = useMemo(() => {
    if (!Array.isArray(roomsData)) return { active: [], past: [] };
    
    const active: any[] = [];
    const past: any[] = [];
    
    roomsData.forEach((room: any) => {
      if (room.is_expired) return;
      
      const isReadOnly = room.type !== 'private' && room.read_only_reason;
      if (isReadOnly) {
        past.push(room);
      } else {
        // Include virtual pending rooms in active conversations
        active.push(room);
      }
    });
    
    return { active, past };
  }, [roomsData]);

  const throttledInvalidate = useCallback(() => {
    if (invalidationThrottleRef.current) return;
    
    invalidationThrottleRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['myChatRooms'] });
      invalidationThrottleRef.current = null;
    }, 2000);
  }, [queryClient]);

  useEffect(() => {
    if (!user?.id || (!rooms.active.length && !rooms.past.length)) return;

    const roomIds = [...rooms.active, ...rooms.past].map((r: any) => r.id);
    
    const channel = supabase
      .channel('chats-room-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (roomIds.includes((payload.new as any).room_id)) {
            throttledInvalidate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (invalidationThrottleRef.current) {
        clearTimeout(invalidationThrottleRef.current);
      }
    };
  }, [user?.id, rooms, throttledInvalidate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        refetch();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [refetch]);

  const sections = useMemo(() => {
    const result: any[] = [];
    if (rooms.active.length > 0) {
      result.push({ type: 'header', title: 'Active Conversations' });
      rooms.active.forEach((r, i) => result.push({ ...r, sectionIndex: i }));
    }
    if (rooms.past.length > 0) {
      if (result.length > 0) result.push({ type: 'spacer' });
      result.push({ type: 'header', title: 'Past Interactions' });
      rooms.past.forEach((r, i) => result.push({ ...r, sectionIndex: i }));
    }
    return result;
  }, [rooms]);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (item.type === 'header') {
        return (
          <View className="mb-3 mt-2 px-1">
            <Text className="text-[13px] font-black uppercase tracking-widest text-primary/60">
              {item.title}
            </Text>
          </View>
        );
      }
      if (item.type === 'spacer') {
        return <View className="h-6" />;
      }
      return (
        <ChatRoomItem
          item={item}
          theme={theme}
          onPress={() => router.push(`/chat/${item.id}`)}
          index={item.sectionIndex || 0}
        />
      );
    },
    [theme, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
          <Animated.View entering={FadeInDown.springify()} className="mb-5 mt-4">
            <View className="flex-row items-center justify-between">
              <View>
                  <Text className="text-3xl font-black tracking-tight text-foreground">Messages</Text>
                  <Text className="mt-2 text-sm font-medium text-muted-foreground">
                    Active and past interactions nearby
                  </Text>
                </View>
            </View>
          </Animated.View>
    
          {isLoading ? (
            <View className="flex-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <ChatItemSkeleton key={i} />
              ))}
            </View>
          ) : (
                <FlashList
                  {...({
                    data: sections,
                    keyExtractor: (item, index) => item.id || `extra-${index}`,
                    onRefresh: () => { refetch(); },
                    refreshing: isFetching,
                    renderItem: renderItem,
                    estimatedItemSize: 80,
                    showsVerticalScrollIndicator: false,
                    contentContainerStyle: { paddingBottom: 120 },
                    ListEmptyComponent: !isFetching ? (
                      <Animated.View entering={FadeIn} className="mt-4 items-center justify-center rounded-3xl border border-border/50 bg-card p-8">
                          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                            <MessageSquare size={28} color={theme.mutedForeground} />
                          </View>
                          <Text className="text-center text-xl font-bold text-foreground">
                            No messages yet
                          </Text>
                          <Text className="mt-2 text-center text-sm text-muted-foreground px-4">
                            Join a zone or start a private chat to see messages here
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
                  } as any)}
                />
          )}
        </View>
    </SafeAreaView>
  );
}
