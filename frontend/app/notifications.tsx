import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, MessageCircle, UserPlus, MapPin, CheckCircle2 } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notifications,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/notifications/${user?.id}`
      );
      return response.json();
    },
    enabled: !!user?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          return <UserPlus size={20} color="#3b82f6" />;
        case 'friend_accept':
          return <CheckCircle2 size={20} color="#10b981" />;
        case 'new_message':
          return <MessageCircle size={20} color="#8b5cf6" />;
        case 'new_room':
          return <MapPin size={20} color="#f59e0b" />;
        default:
          return <Bell size={20} color="#6b7280" />;
      }
    };

    const handlePress = () => {
      if (item.data?.room_id) {
        router.push(`/chat/${item.data.room_id}`);
      } else if (item.type === 'friend_request' || item.type === 'friend_accept') {
        router.push('/(tabs)/friends');
      }
    };

    return (
      <TouchableOpacity
        onPress={handlePress}
        className={`mb-3 flex-row items-center rounded-3xl border p-4 ${item.is_read ? 'border-border/50 bg-card' : 'border-primary/20 bg-primary/5'}`}>
        <View
          className={`h-12 w-12 items-center justify-center rounded-full ${item.is_read ? 'bg-secondary' : 'bg-primary/10'}`}>
          {getIcon()}
        </View>
        <View className="ml-4 flex-1">
          <Text
            className={`text-base font-bold ${item.is_read ? 'text-foreground' : 'text-primary'}`}>
            {item.title}
          </Text>
          <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={2}>
            {item.content}
          </Text>
          <Text className="mt-2 text-[10px] uppercase tracking-tighter text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString()} at{' '}
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen
        options={{ title: 'Notifications', headerTransparent: true, headerTitle: '' }}
      />
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-foreground">Activity</Text>
            <Text className="text-sm text-muted-foreground">
              Stay updated on your interactions.
            </Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border bg-secondary/20 p-10">
                <Bell size={40} color="#9ca3af" />
                <Text className="mt-4 text-center text-lg font-semibold text-muted-foreground">
                  All quiet for now.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Your notifications will appear here.
                </Text>
              </View>
            }
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
