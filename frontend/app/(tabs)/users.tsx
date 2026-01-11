import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { useState } from 'react';
import { UserPlus, Clock, MapPin, Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function UsersScreen() {
  const { user } = useAuth();
  const { location } = useLocation(user?.id);
  const queryClient = useQueryClient();
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const {
    data: nearbyUsers,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['nearbyUsers', location?.coords.latitude, location?.coords.longitude],
    queryFn: async () => {
      if (!location || !user?.id) return [];

      const { latitude, longitude } = location.coords;
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/profiles/nearby?lat=${latitude}&lng=${longitude}&radius=5000&userId=${user.id}`
      );
      return response.json();
    },
    enabled: !!location && !!user?.id,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: user?.id, receiver_id: receiverId }),
      });
      if (!response.ok) throw new Error('Failed to send request');
      return receiverId;
    },
    onSuccess: (receiverId) => {
      setSentRequests((prev) => new Set([...prev, receiverId]));
      Alert.alert('Success', 'Friend request sent!');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to send request');
    },
  });

  const renderUser = ({ item }: { item: any }) => (
    <View className="mb-4 flex-row items-center rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="h-16 w-16" />
        ) : (
          <Text className="text-2xl font-bold text-muted-foreground">
            {item.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-foreground">
          {item.full_name || item.username || 'Anonymous'}
        </Text>
        <View className="mt-1 flex-row items-center">
          <MapPin size={12} color="#9ca3af" />
          <Text className="ml-1 text-xs text-muted-foreground">Nearby</Text>
        </View>
      </View>

      {sentRequests.has(item.id) ? (
        <View className="flex-row items-center rounded-full bg-secondary/50 px-4 py-2">
          <Clock size={14} color="#9ca3af" />
          <Text className="ml-2 text-xs font-bold text-muted-foreground">Pending</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => sendRequestMutation.mutate(item.id)}
          disabled={sendRequestMutation.isPending}
          className="rounded-full bg-primary px-4 py-2">
          <Text className="text-xs font-bold text-primary-foreground">
            {sendRequestMutation.isPending ? '...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Discover</Text>
          <Text className="text-sm text-muted-foreground">Find people nearby and connect.</Text>
        </View>

        <View className="mb-6 flex-row items-center rounded-2xl bg-secondary/50 px-4 py-3">
          <Search size={20} color="#9ca3af" />
          <Text className="ml-3 text-muted-foreground">Search for people...</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={nearbyUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border bg-secondary/20 p-10">
                <MapPin size={40} color="#9ca3af" />
                <Text className="mt-4 text-center text-lg font-semibold text-muted-foreground">
                  No one else nearby yet.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Try moving to a different location or check back later!
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
