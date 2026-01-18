import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { User, Check, X, ChevronLeft, UserPlus, Inbox } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function FriendRequestsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['friendRequests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return apiRequest(`/friend-requests/${user.id}`);
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: 'accepted' | 'rejected' }) => {
      return apiRequest(`/friend-requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleAccept = (requestId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    respondMutation.mutate({ requestId, status: 'accepted' });
  };

  const handleReject = (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    respondMutation.mutate({ requestId, status: 'rejected' });
  };

  const renderRequest = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View className="mb-3 flex-row items-center rounded-2xl border border-border/50 bg-card p-4">
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
          {item.sender?.avatar_url ? (
            <Image
              source={{ uri: item.sender.avatar_url }}
              style={{ width: 48, height: 48 }}
              contentFit="cover"
            />
          ) : (
            <User size={22} color={theme.primary} />
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {item.sender?.full_name || item.sender?.username || 'Unknown'}
          </Text>
          <Text className="text-xs text-muted-foreground">
            @{item.sender?.username || 'user'}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleReject(item.id)}
            disabled={respondMutation.isPending}
            className="h-9 w-9 items-center justify-center rounded-xl bg-secondary">
            <X size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleAccept(item.id)}
            disabled={respondMutation.isPending}
            className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
            {respondMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Check size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-5">
        <View className="mb-5 mt-4 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl bg-card border border-border/50">
            <ChevronLeft size={20} color={theme.foreground} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">Friend Requests</Text>
            <Text className="text-xs text-muted-foreground">
              {(requests?.length || 0)} pending
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlashList
            data={requests || []}
            keyExtractor={(item: any) => item.id}
            renderItem={renderRequest}
            estimatedItemSize={80}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={false}
            ListEmptyComponent={
              <Animated.View entering={FadeIn} className="items-center justify-center py-20 px-6">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-card mb-4">
                  <Inbox size={28} color={theme.mutedForeground} />
                </View>
                <Text className="text-lg font-bold text-foreground text-center">No requests</Text>
                <Text className="mt-1 text-sm text-muted-foreground text-center">
                  Friend requests will appear here
                </Text>
              </Animated.View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
