import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation } from '@/hooks/useLocation';
import { useEffect, useState } from 'react';
import { UserPlus, Check, Clock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function UsersScreen() {
  const { user } = useAuth();
  const { location } = useLocation(user?.id);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const { data: nearbyUsers, isLoading, refetch } = useQuery({
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

  async function sendFriendRequest(receiverId: string) {
    if (!user?.id) return;

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: user.id, receiver_id: receiverId }),
      });

      if (response.ok) {
        setSentRequests((prev) => new Set([...prev, receiverId]));
        Alert.alert('Success', 'Friend request sent!');
      } else {
        const err = await response.json();
        Alert.alert('Error', err.error || 'Failed to send request');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred');
    }
  }

  const { data: incomingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['incomingRequests', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/requests/${userId}`);
      return response.json();
    },
    enabled: !!userId,
  });

  async function acceptRequest(requestId: string) {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Friend request accepted!');
        refetchRequests();
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Discover</Text>
          <Text className="text-sm text-muted-foreground">
            People nearby you in real time.
          </Text>
        </View>

        {incomingRequests && incomingRequests.length > 0 && (
          <View className="mb-6">
            <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Friend Requests ({incomingRequests.length})
            </Text>
            {incomingRequests.map((req: any) => (
              <View key={req.id} className="mb-2 flex-row items-center rounded-2xl bg-primary/5 p-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <Text className="text-base font-bold text-muted-foreground">
                    {req.sender?.username?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-foreground">{req.sender?.username}</Text>
                  <Text className="text-xs text-muted-foreground">wants to connect</Text>
                </View>
                <TouchableOpacity
                  onPress={() => acceptRequest(req.id)}
                  className="rounded-full bg-primary px-4 py-2"
                >
                  <Text className="text-xs font-bold text-primary-foreground">Accept</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Nearby People
        </Text>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={nearbyUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="mb-4 flex-row items-center rounded-2xl bg-card p-4 shadow-sm">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} className="h-12 w-12 rounded-full" />
                  ) : (
                    <Text className="text-lg font-bold text-muted-foreground">
                      {item.username?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-semibold text-foreground">
                    {item.full_name || item.username || 'Anonymous'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    @{item.username || 'user'}
                  </Text>
                </View>
                
                {sentRequests.has(item.id) ? (
                  <View className="rounded-full bg-secondary p-2">
                    <Clock size={20} color="#9ca3af" />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => sendFriendRequest(item.id)}
                    className="rounded-full bg-primary p-2"
                  >
                    <UserPlus size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center p-10">
                <Text className="text-center text-lg text-muted-foreground">
                  No one else nearby yet.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Be the first to Tap In here!
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
