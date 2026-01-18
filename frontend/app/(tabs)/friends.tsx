import React, { useMemo, useCallback, memo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, Dimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { User, MessageCircle, Heart, UserPlus, Compass, WifiOff, RefreshCw, Users, ChevronRight, Camera, X, Plus, ImageIcon, Send, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';
import Animated, { FadeInDown, FadeIn, FadeInUp, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FriendItemSkeleton = () => (
  <View className="mb-3 flex-row items-center rounded-3xl border border-border/50 bg-card p-4">
    <View className="h-14 w-14 rounded-2xl bg-secondary/80" />
    <View className="ml-4 flex-1 gap-2.5">
      <View className="h-4 w-32 rounded-lg bg-secondary/80" />
      <View className="h-3 w-20 rounded-lg bg-secondary/60" />
    </View>
    <View className="h-10 w-10 rounded-xl bg-secondary/60" />
  </View>
);

const FriendItem = memo(({ item, theme, onPress, index }: { item: any; theme: any; onPress: () => void; index: number }) => (
  <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/15">
        {item.avatar_url ? (
          <Image 
            source={{ uri: item.avatar_url }} 
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <User size={24} color={theme.primary} />
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {item.full_name || item.username}
        </Text>
        <View className="flex-row items-center mt-1.5">
          <View className="bg-secondary/60 px-2 py-0.5 rounded-md">
            <Text className="text-[10px] font-semibold text-muted-foreground">@{item.username}</Text>
          </View>
        </View>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
        <MessageCircle size={18} color={theme.primary} />
      </View>
    </TouchableOpacity>
  </Animated.View>
));

const TapinItem = memo(({ tapin, theme, onPress, index }: { tapin: any; theme: any; onPress: () => void; index: number }) => {
  const isViewed = !!tapin.viewed_at;
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="items-center mr-3">
        <View className={`h-16 w-16 rounded-2xl overflow-hidden ${!isViewed ? 'border-2 border-primary' : 'border border-border/50'}`}>
          {tapin.sender?.avatar_url ? (
            <Image
              source={{ uri: tapin.sender.avatar_url }}
              style={{ width: 64, height: 64 }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-secondary">
              <User size={22} color={!isViewed ? theme.primary : theme.mutedForeground} />
            </View>
          )}
        </View>
        <Text className={`text-[10px] mt-1.5 text-center w-16 ${!isViewed ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`} numberOfLines={1}>
          {tapin.sender?.full_name?.split(' ')[0] || tapin.sender?.username || 'Friend'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function FriendsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentTapinIndex, setCurrentTapinIndex] = useState(0);
  const [replyText, setReplyText] = useState('');

    const { data: friendsData, isLoading, isError, error, refetch } = useQuery({
      queryKey: ['friends', user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        return apiRequest(`/friends/${user.id}`);
      },
      enabled: !!user?.id,
      staleTime: 60000 * 5,
      gcTime: 1000 * 60 * 30,
      placeholderData: (prev) => prev,
    });

    const { data: pendingRequests } = useQuery({
      queryKey: ['friendRequests', user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        return apiRequest(`/friend-requests/${user.id}`);
      },
      enabled: !!user?.id,
      staleTime: 30000,
    });

  const { data: tapins, refetch: refetchTapins } = useQuery({
    queryKey: ['tapins', 'received', user?.id],
    queryFn: () => apiRequest(`/tapins/received/${user?.id}`),
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const viewTapinMutation = useMutation({
    mutationFn: (tapinId: string) => apiRequest(`/tapins/${tapinId}/view`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tapins'] }),
  });

  const handleTapinPress = (tapin: any, index: number) => {
    setCurrentTapinIndex(index);
    setViewerOpen(true);
    if (!tapin.viewed_at) {
      viewTapinMutation.mutate(tapin.id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const goToNextTapin = () => {
    if (tapins && currentTapinIndex < tapins.length - 1) {
      const nextIndex = currentTapinIndex + 1;
      setCurrentTapinIndex(nextIndex);
      if (!tapins[nextIndex].viewed_at) {
        viewTapinMutation.mutate(tapins[nextIndex].id);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      setViewerOpen(false);
    }
  };

  const goToPrevTapin = () => {
    if (currentTapinIndex > 0) {
      setCurrentTapinIndex(currentTapinIndex - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const currentTapin = tapins?.[currentTapinIndex];

  const pendingCount = pendingRequests?.length || 0;


  const friends = useMemo(() => friendsData || [], [friendsData]);

  const renderFriend = useCallback(({ item, index }: { item: any; index: number }) => (
    <FriendItem 
      item={item} 
      theme={theme} 
      onPress={() => router.push(`/chat/private_${item.id}`)} 
      index={index}
    />
  ), [theme, router]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
          <Animated.View entering={FadeInDown.springify()} className="mb-5 mt-4 flex-row items-center justify-between">
            <View>
              <Text className="text-3xl font-black tracking-tight text-foreground">Friends</Text>
              <Text className="mt-2 text-sm font-medium text-muted-foreground">
                Your connections
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/users')}
              activeOpacity={0.8}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
              <UserPlus size={22} color={theme.primaryForeground} />
            </TouchableOpacity>
          </Animated.View>

<Animated.View entering={FadeInDown.delay(25).springify()} className="mb-5">
              <View className="bg-card/50 border border-border/30 rounded-2xl p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <View className="h-7 w-7 rounded-lg bg-primary/15 items-center justify-center">
                      <ImageIcon size={14} color={theme.primary} />
                    </View>
                    <Text className="text-sm font-semibold text-foreground">Photos</Text>
                  </View>
                  {tapins && tapins.filter((t: any) => !t.viewed_at).length > 0 && (
                    <View className="bg-primary/15 px-2 py-0.5 rounded-md">
                      <Text className="text-[10px] font-bold text-primary">{tapins.filter((t: any) => !t.viewed_at).length} NEW</Text>
                    </View>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 px-1">
                  <TouchableOpacity
                    onPress={() => router.push('/send-tapin')}
                    activeOpacity={0.8}
                    className="items-center mr-3">
                    <View className="h-16 w-16 rounded-2xl bg-primary items-center justify-center">
                      <Camera size={24} color="#fff" strokeWidth={2} />
                    </View>
                    <Text className="text-[10px] font-semibold text-primary mt-1.5">Send</Text>
                  </TouchableOpacity>
                    {tapins?.map((tapin: any, index: number) => (
                      <TapinItem
                        key={tapin.id}
                        tapin={tapin}
                        theme={theme}
                        onPress={() => handleTapinPress(tapin, index)}
                        index={index}
                      />
                    ))}
                  {(!tapins || tapins.length === 0) && (
                    <View className="items-center justify-center pl-4 pr-8">
                      <Text className="text-xs text-muted-foreground">No tapins yet</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </Animated.View>

          {pendingCount > 0 && (
            <Animated.View entering={FadeInDown.delay(50).springify()}>
              <TouchableOpacity
                onPress={() => router.push('/friend-requests')}
                activeOpacity={0.7}
                className="mb-4 flex-row items-center rounded-2xl bg-primary/10 border border-primary/20 p-3.5">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
                  <Users size={18} color="#fff" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-foreground">Pending Requests</Text>
                  <Text className="text-xs text-muted-foreground">{pendingCount} {pendingCount === 1 ? 'person wants' : 'people want'} to connect</Text>
                </View>
                <ChevronRight size={18} color={theme.primary} />
              </TouchableOpacity>
            </Animated.View>
          )}

        {isLoading ? (
          <View className="flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <FriendItemSkeleton key={i} />
            ))}
          </View>
        ) : isError ? (
          <Animated.View entering={FadeIn} className="mt-4 items-center justify-center p-8 rounded-3xl border border-destructive/20 bg-destructive/5">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-background border border-border mb-4">
              <WifiOff size={28} color={theme.destructive} />
            </View>
            <Text className="text-xl font-bold text-foreground text-center">
              Connection Issue
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground px-4">
              {(error as Error)?.message || 'Unable to load friends.'}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.8}
              className="mt-5 flex-row items-center gap-2 rounded-2xl bg-primary px-6 py-3">
              <RefreshCw size={16} color={theme.primaryForeground} />
              <Text className="text-sm font-bold text-primary-foreground">Try Again</Text>
            </TouchableOpacity>
          </Animated.View>
          ) : (
            <View className="flex-1">
              <FlashList
                data={friends}
                keyExtractor={(item: any) => item.id}
                renderItem={renderFriend}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                onRefresh={refetch}
                refreshing={false}
                estimatedItemSize={80}
                ListEmptyComponent={
                <Animated.View entering={FadeIn} className="mt-4 items-center justify-center rounded-3xl border border-border/50 bg-card p-8">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                    <Heart size={28} color={theme.mutedForeground} />
                  </View>
                  <Text className="text-center text-xl font-bold text-foreground">
                    No friends yet
                  </Text>
                  <Text className="mt-2 text-center text-sm text-muted-foreground px-4">
                    Find people nearby and start connecting!
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/users')}
                    activeOpacity={0.8}
                    className="mt-6 flex-row items-center gap-2 rounded-2xl bg-primary px-6 py-3.5">
                    <Compass size={18} color={theme.primaryForeground} />
                    <Text className="font-bold text-primary-foreground">Explore</Text>
                  </TouchableOpacity>
                </Animated.View>
              }
            />
          </View>
          )}
        </View>

<Modal
        visible={viewerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerOpen(false)}>
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            {currentTapin && (
              <>
                <View className="flex-row items-center px-4 py-3">
                  <TouchableOpacity
                    onPress={() => setViewerOpen(false)}
                    className="h-10 w-10 rounded-full bg-white/10 items-center justify-center">
                    <X size={20} color="#fff" />
                  </TouchableOpacity>
                  
                  {tapins && tapins.length > 1 && (
                    <View className="flex-1 flex-row items-center justify-center gap-1.5 px-4">
                      {tapins.map((_: any, idx: number) => (
                        <View
                          key={idx}
                          className={`h-1 flex-1 rounded-full max-w-8 ${
                            idx === currentTapinIndex ? 'bg-white' : 'bg-white/30'
                          }`}
                        />
                      ))}
                    </View>
                  )}
                  
                  <TouchableOpacity
                    onPress={() => router.push(`/user/${currentTapin.sender?.id}`)}
                    className="flex-row items-center gap-2">
                    <Text className="text-white font-semibold text-sm">
                      {currentTapin.sender?.full_name?.split(' ')[0] || currentTapin.sender?.username}
                    </Text>
                    <View className="h-9 w-9 rounded-full overflow-hidden bg-white/10">
                      {currentTapin.sender?.avatar_url ? (
                        <Image
                          source={{ uri: currentTapin.sender.avatar_url }}
                          style={{ width: 36, height: 36 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <User size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                <Pressable
                  onPress={(e) => {
                    const touchX = e.nativeEvent.locationX;
                    if (touchX < SCREEN_WIDTH / 3) {
                      goToPrevTapin();
                    } else {
                      goToNextTapin();
                    }
                  }}
                  className="flex-1 px-3">
                  <View className="flex-1 rounded-3xl overflow-hidden bg-neutral-900">
                    <Image
                      source={{ uri: currentTapin.image_url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={150}
                    />
                    {currentTapin.caption && (
                      <View className="absolute bottom-0 left-0 right-0 p-5">
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          className="absolute inset-0"
                        />
                        <Text className="text-white text-center text-base font-medium relative z-10">
                          {currentTapin.caption}
                        </Text>
                      </View>
                    )}
                    
                    {currentTapinIndex > 0 && (
                      <View className="absolute left-3 top-1/2 -translate-y-1/2">
                        <ChevronLeft size={28} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                    {tapins && currentTapinIndex < tapins.length - 1 && (
                      <View className="absolute right-3 top-1/2 -translate-y-1/2">
                        <ChevronRight size={28} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                  </View>
                </Pressable>

                <View className="px-4 pt-3 pb-2">
                  <Text className="text-white/40 text-[10px] text-center mb-3">
                    {new Date(currentTapin.created_at).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      hour: 'numeric', 
                      minute: '2-digit'
                    })}
                  </Text>
                  
                  <TouchableOpacity
                    onPress={() => {
                      setViewerOpen(false);
                      router.push(`/send-tapin?friendId=${currentTapin.sender.id}`);
                    }}
                    activeOpacity={0.9}
                    className="mb-2">
                    <LinearGradient
                      colors={['#8b5cf6', '#7c3aed']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="h-12 rounded-2xl flex-row items-center justify-center gap-2">
                      <Camera size={18} color="#fff" strokeWidth={2.5} />
                      <Text className="text-white font-bold text-sm">Reply with Photo</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      setViewerOpen(false);
                      router.push(`/chat/private_${currentTapin.sender.id}`);
                    }}
                    activeOpacity={0.8}
                    className="h-12 rounded-2xl bg-white/10 flex-row items-center justify-center gap-2">
                    <MessageCircle size={18} color="#fff" />
                    <Text className="text-white font-semibold text-sm">Message</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
