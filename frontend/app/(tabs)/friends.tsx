import React, { useMemo, useCallback, memo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { User, MessageCircle, Heart, UserPlus, Compass, WifiOff, RefreshCw, Users, ChevronRight, Camera, X, Plus, ImageIcon, Send } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

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
        <View className="relative">
          {!isViewed ? (
            <LinearGradient
              colors={['#ec4899', '#f472b6', '#fb7185']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-[3px] rounded-[22px] shadow-lg shadow-pink-500/30">
              <View className="h-[68px] w-[68px] rounded-[20px] overflow-hidden bg-card">
                {tapin.sender?.avatar_url ? (
                  <Image
                    source={{ uri: tapin.sender.avatar_url }}
                    style={{ width: 68, height: 68 }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center bg-secondary">
                    <User size={26} color={theme.primary} />
                  </View>
                )}
              </View>
            </LinearGradient>
          ) : (
            <View className="p-[2px] rounded-[22px] bg-border/50">
              <View className="h-[68px] w-[68px] rounded-[20px] overflow-hidden bg-card">
                {tapin.sender?.avatar_url ? (
                  <Image
                    source={{ uri: tapin.sender.avatar_url }}
                    style={{ width: 68, height: 68 }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center bg-secondary">
                    <User size={26} color={theme.mutedForeground} />
                  </View>
                )}
              </View>
            </View>
          )}
          {!isViewed && (
              <View className="absolute -bottom-1 -right-1 bg-pink-500 rounded-full p-1 border-2 border-background">
                <ImageIcon size={10} color="#fff" />
              </View>
            )}
        </View>
        <Text className={`text-[11px] mt-2 text-center w-[72px] ${!isViewed ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`} numberOfLines={1}>
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
  const [selectedTapin, setSelectedTapin] = useState<any>(null);

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

  const handleTapinPress = (tapin: any) => {
    setSelectedTapin(tapin);
    if (!tapin.viewed_at) {
      viewTapinMutation.mutate(tapin.id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
              <View className="bg-card/50 border border-border/30 rounded-3xl p-4">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <View className="h-8 w-8 rounded-xl bg-pink-500/15 items-center justify-center">
                      <ImageIcon size={16} color="#ec4899" />
                    </View>
                    <Text className="text-sm font-bold text-foreground">Images</Text>
                  </View>
                  {tapins && tapins.length > 0 && (
                    <View className="bg-pink-500/15 px-2.5 py-1 rounded-full">
                      <Text className="text-[10px] font-bold text-pink-500">{tapins.filter((t: any) => !t.viewed_at).length} NEW</Text>
                    </View>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 px-1">
                  <TouchableOpacity
                    onPress={() => router.push('/send-tapin')}
                    activeOpacity={0.8}
                    className="items-center mr-3">
                    <View className="relative">
                      <LinearGradient
                        colors={['#ec4899', '#f472b6', '#fb7185']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="h-[74px] w-[74px] rounded-[22px] items-center justify-center shadow-xl shadow-pink-500/40">
                        <View className="h-10 w-10 rounded-xl bg-white/20 items-center justify-center">
                          <Camera size={22} color="#fff" strokeWidth={2.5} />
                        </View>
                      </LinearGradient>
                    </View>
                    <Text className="text-[11px] font-bold text-pink-500 mt-2">Send Img</Text>
                  </TouchableOpacity>
                  {tapins?.map((tapin: any, index: number) => (
                    <TapinItem
                      key={tapin.id}
                      tapin={tapin}
                      theme={theme}
                      onPress={() => handleTapinPress(tapin)}
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
            visible={!!selectedTapin}
            animationType="fade"
            transparent
            onRequestClose={() => setSelectedTapin(null)}>
            <Pressable
              onPress={() => setSelectedTapin(null)}
              className="flex-1 bg-black items-center justify-center">
              {selectedTapin && (
                <Animated.View entering={FadeIn} className="w-full h-full">
                  <SafeAreaView className="flex-1">
                    <View className="flex-row items-center px-5 py-4">
                      <TouchableOpacity
                        onPress={() => setSelectedTapin(null)}
                        className="h-11 w-11 rounded-full bg-white/10 items-center justify-center">
                        <X size={22} color="#fff" />
                      </TouchableOpacity>
                      <View className="flex-1 items-center">
                        <Text className="text-white font-bold text-base">
                          {selectedTapin.sender?.full_name || selectedTapin.sender?.username}
                        </Text>
                        <Text className="text-white/50 text-xs mt-0.5">
                          {new Date(selectedTapin.created_at).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            hour: 'numeric', 
                            minute: '2-digit'
                          })}
                        </Text>
                      </View>
                      <View className="h-11 w-11 rounded-full overflow-hidden bg-white/10">
                        {selectedTapin.sender?.avatar_url ? (
                          <Image
                            source={{ uri: selectedTapin.sender.avatar_url }}
                            style={{ width: 44, height: 44 }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <User size={20} color="#fff" />
                          </View>
                        )}
                      </View>
                    </View>

                    <View className="flex-1 px-4 justify-center">
                      <View className="aspect-[3/4] w-full rounded-[40px] overflow-hidden bg-neutral-900">
                        <Image
                          source={{ uri: selectedTapin.image_url }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          transition={200}
                        />
                        {selectedTapin.caption && (
                          <View className="absolute bottom-0 left-0 right-0 p-6">
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.8)']}
                              className="absolute inset-0"
                            />
                            <Text className="text-white text-center text-lg font-semibold relative z-10">
                              {selectedTapin.caption}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View className="px-6 pb-8 pt-4">
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTapin(null);
                          router.push(`/send-tapin?friendId=${selectedTapin.sender.id}`);
                        }}
                        activeOpacity={0.9}>
                        <LinearGradient
                          colors={['#fcd34d', '#f59e0b', '#d97706']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          className="h-14 rounded-full flex-row items-center justify-center gap-2.5">
                          <Camera size={20} color="#000" strokeWidth={2.5} />
                          <Text className="text-black font-bold text-base">Send one back</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </SafeAreaView>
                </Animated.View>
              )}
            </Pressable>
          </Modal>
    </SafeAreaView>
  );
}
