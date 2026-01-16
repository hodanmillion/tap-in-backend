import React, { useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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

  const renderFriend = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/chat/private_${item.id}`)}
      className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4 shadow-sm active:bg-secondary/10">
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/5">
        {item.avatar_url ? (
          <Image 
            source={{ uri: item.avatar_url }} 
            style={{ width: 56, height: 56 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <User size={24} color={theme.primary} />
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-foreground leading-tight" numberOfLines={1}>
          {item.full_name || item.username}
        </Text>
        <Text className="text-xs font-semibold text-muted-foreground mt-1">@{item.username}</Text>
      </View>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary/50">
        <MessageCircle size={18} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
        <View className="mb-8 mt-6 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black tracking-tight text-foreground">Friends</Text>
            <Text className="mt-1 text-sm font-semibold text-muted-foreground">
              Your inner circle
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/users')}
            activeOpacity={0.8}
            className="h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
            <UserPlus size={22} color={theme.primaryForeground} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : isError ? (
          <View className="mt-10 items-center justify-center p-12 rounded-[40px] border-2 border-dashed border-destructive/30 bg-destructive/5">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-background border border-border mb-6">
              <WifiOff size={40} color={theme.destructive} opacity={0.6} />
            </View>
            <Text className="text-2xl font-black text-foreground text-center">
              Connection Issue
            </Text>
            <Text className="mt-2 text-center text-base font-medium text-muted-foreground px-4">
              {(error as Error)?.message || 'Unable to load friends. Check your connection.'}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.8}
              className="mt-6 flex-row items-center gap-2 rounded-2xl bg-primary px-6 py-3">
              <RefreshCw size={18} color={theme.primaryForeground} />
              <Text className="text-sm font-bold text-primary-foreground">Try Again</Text>
            </TouchableOpacity>
          </View>
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
                <View className="mt-10 items-center justify-center rounded-[40px] border-2 border-dashed border-border/60 bg-secondary/50 p-12">
                  <View className="h-24 w-24 items-center justify-center rounded-full bg-background border border-border mb-8 shadow-sm">
                    <Heart size={40} color={theme.mutedForeground} opacity={0.4} />
                  </View>
                  <Text className="text-center text-2xl font-black text-foreground">
                    No friends yet
                  </Text>
                  <Text className="mt-3 text-center text-base font-medium text-muted-foreground px-4">
                    Find interesting people nearby and start building your circle!
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/users')}
                    activeOpacity={0.8}
                    className="mt-8 flex-row items-center gap-2 rounded-2xl bg-primary px-8 py-4">
                    <Compass size={20} color={theme.primaryForeground} />
                    <Text className="font-black text-primary-foreground uppercase tracking-widest">Explore</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
