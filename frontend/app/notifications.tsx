import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, MessageCircle, UserPlus, MapPin, CheckCircle2, ChevronLeft, X } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      return apiRequest(`/notifications/${user?.id}`);
    },
    enabled: !!user?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest('/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notificationIds: ids }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const unreadIds = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
      if (unreadIds.length > 0) {
        markReadMutation.mutate(unreadIds);
      }
    }
  }, [notifications]);

  const renderNotification = ({ item }: { item: any }) => {
    const getIcon = () => {
      switch (item.type) {
        case 'friend_request':
          return <UserPlus size={20} color={theme.primary} />;
        case 'friend_accept':
          return <CheckCircle2 size={20} color="#10b981" />;
        case 'new_message':
          return <MessageCircle size={20} color={theme.primary} />;
        case 'new_room':
          return <MapPin size={20} color="#f59e0b" />;
        default:
          return <Bell size={20} color={theme.mutedForeground} />;
      }
    };

      const handlePress = () => {
        if (item.data?.room_id) {
          router.push(`/chat/${item.data.room_id}`);
        } else if (item.type === 'friend_request') {
          router.push('/friend-requests');
        } else if (item.type === 'friend_request_accepted') {
          router.push('/(tabs)/friends');
        }
      };

    return (
      <TouchableOpacity
        onPress={handlePress}
        className={`mb-4 flex-row items-center rounded-3xl border p-4 shadow-sm active:opacity-70 ${
          item.is_read ? 'border-border bg-card' : 'border-primary/20 bg-primary/5'
        }`}>
        <View
          className={`h-12 w-12 items-center justify-center rounded-2xl ${
            item.is_read ? 'bg-secondary' : 'bg-primary/10'
          }`}>
          {getIcon()}
        </View>
        <View className="ml-4 flex-1">
          <Text
            className={`text-base font-bold ${item.is_read ? 'text-foreground' : 'text-primary'}`}>
            {item.title}
          </Text>
          <Text className="mt-0.5 text-sm font-medium text-muted-foreground" numberOfLines={2}>
            {item.content}
          </Text>
          <Text className="mt-2 text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">
            {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-6">
        <View className="mb-8 mt-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-4">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary border border-border">
              <ChevronLeft size={24} color={theme.foreground} />
            </TouchableOpacity>
            <View>
              <Text className="text-4xl font-black tracking-tight text-foreground">Activity</Text>
              <Text className="text-base font-medium text-muted-foreground">Stay in the loop.</Text>
            </View>
          </View>
        </View>

        {isLoading && !isFetching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border p-10">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary mb-6">
                  <Bell size={32} color={theme.mutedForeground} opacity={0.3} />
                </View>
                <Text className="text-center text-xl font-black text-foreground">All caught up</Text>
                <Text className="mt-2 text-center text-sm font-medium text-muted-foreground">
                  Your notifications will appear here when things happen!
                </Text>
              </View>
            }
            onRefresh={refetch}
            refreshing={isFetching}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
