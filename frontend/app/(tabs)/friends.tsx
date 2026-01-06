import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserCheck, UserPlus, MessageCircle, Heart } from 'lucide-react-native';
import { router } from 'expo-router';

export default function FriendsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: friends, isLoading: loadingFriends, refetch: refetchFriends } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/${user?.id}`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: requests, isLoading: loadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['friendRequests', user?.id],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/requests/${user?.id}`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      Alert.alert('Success', 'Friend request accepted!');
    },
  });

  const startChat = async (friendId: string) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/rooms/private`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1_id: user?.id, user2_id: friendId }),
      });
      const data = await response.json();
      if (data.room_id) {
        router.push(`/chat/${data.room_id}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start chat');
    }
  };

  const renderFriend = ({ item }: { item: any }) => (
    <View className="mb-4 flex-row items-center rounded-3xl bg-card p-4 shadow-sm border border-border/50">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="h-14 w-14 rounded-full" />
        ) : (
          <Text className="text-xl font-bold text-muted-foreground">
            {item.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-foreground">
          {item.full_name || item.username || 'Anonymous'}
        </Text>
        <Text className="text-sm text-muted-foreground">@{item.username || 'user'}</Text>
      </View>
      <TouchableOpacity
        onPress={() => startChat(item.id)}
        className="h-10 w-10 items-center justify-center rounded-full bg-primary/10"
      >
        <MessageCircle size={20} color="#3b82f6" />
      </TouchableOpacity>
    </View>
  );

  const renderRequest = ({ item }: { item: any }) => (
    <View className="mb-4 flex-row items-center rounded-3xl bg-primary/5 p-4 border border-primary/10">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Text className="text-lg font-bold text-muted-foreground">
          {item.sender?.username?.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="ml-4 flex-1">
        <Text className="font-bold text-foreground">{item.sender?.username}</Text>
        <Text className="text-xs text-muted-foreground">Sent you a friend request</Text>
      </View>
      <TouchableOpacity
        onPress={() => acceptMutation.mutate(item.id)}
        disabled={acceptMutation.isPending}
        className="rounded-full bg-primary px-4 py-2"
      >
        <Text className="text-xs font-bold text-primary-foreground">
          {acceptMutation.isPending ? '...' : 'Accept'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Friends</Text>
          <Text className="text-sm text-muted-foreground">Manage your connections.</Text>
        </View>

        {requests && requests.length > 0 && (
          <View className="mb-8">
            <View className="mb-4 flex-row items-center">
              <Heart size={18} color="#ef4444" fill="#ef4444" />
              <Text className="ml-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Requests ({requests.length})
              </Text>
            </View>
            <FlatList
              data={requests}
              renderItem={renderRequest}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        <View className="flex-1">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              My Friends ({friends?.length || 0})
            </Text>
          </View>

          {loadingFriends ? (
            <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
          ) : (
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View className="mt-10 items-center justify-center p-10 bg-secondary/20 rounded-3xl border border-dashed border-border">
                  <UserPlus size={40} color="#9ca3af" />
                  <Text className="mt-4 text-center text-lg font-semibold text-muted-foreground">
                    No friends yet.
                  </Text>
                  <Text className="mt-2 text-center text-sm text-muted-foreground">
                    Discover people nearby and send them a request!
                  </Text>
                  <TouchableOpacity 
                    onPress={() => router.push('/users')}
                    className="mt-6 rounded-full bg-primary/10 px-6 py-2"
                  >
                    <Text className="font-bold text-primary">Discover People</Text>
                  </TouchableOpacity>
                </View>
              }
              onRefresh={refetchFriends}
              refreshing={loadingFriends}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
