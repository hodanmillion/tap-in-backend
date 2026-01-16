import React, { useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { User, MessageCircle, Heart, UserPlus, Compass, WifiOff, RefreshCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

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

export default function FriendsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

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
    </SafeAreaView>
  );
}
