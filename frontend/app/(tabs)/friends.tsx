import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserCheck, UserPlus, MessageCircle, Heart, Search, X, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';

export default function FriendsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: friends,
    isLoading: loadingFriends,
    refetch: refetchFriends,
  } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/${user?.id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.id,
  });

  const {
    data: requests,
    isLoading: loadingRequests,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['friendRequests', user?.id],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/requests/${user?.id}`
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.id,
  });

  const filteredFriends = useMemo(() => {
    if (!friends) return [];
    if (!searchQuery) return friends;
    const lowerQuery = searchQuery.toLowerCase();
    return friends.filter(
      (f: any) =>
        f.username?.toLowerCase().includes(lowerQuery) ||
        f.full_name?.toLowerCase().includes(lowerQuery)
    );
  }, [friends, searchQuery]);

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
    <View className="mb-4 flex-row items-center rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-secondary/50">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="h-14 w-14" />
        ) : (
          <Text className="text-xl font-bold text-muted-foreground/50">
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
        activeOpacity={0.7}
        className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle size={22} color="#3b82f6" />
      </TouchableOpacity>
    </View>
  );

  const renderRequest = ({ item }: { item: any }) => (
    <View className="mb-4 flex-row items-center rounded-3xl border border-blue-500/20 bg-blue-500/5 p-4">
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-secondary/50">
        {item.sender?.avatar_url ? (
          <Image source={{ uri: item.sender.avatar_url }} className="h-12 w-12" />
        ) : (
          <Text className="text-lg font-bold text-muted-foreground/50">
            {item.sender?.username?.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="font-bold text-foreground">{item.sender?.username}</Text>
        <Text className="text-xs text-muted-foreground">Sent you a friend request</Text>
      </View>
      <TouchableOpacity
        onPress={() => acceptMutation.mutate(item.id)}
        disabled={acceptMutation.isPending}
        activeOpacity={0.7}
        className="rounded-full bg-primary px-5 py-2">
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
          <Text className="text-4xl font-extrabold tracking-tight text-foreground">Friends</Text>
          <Text className="mt-1 text-base text-muted-foreground">Manage your connections.</Text>
        </View>

        {requests && requests.length > 0 && (
          <View className="mb-8">
            <View className="mb-4 flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-blue-500 animate-pulse mr-2" />
              <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
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

        <View className="mb-6 flex-row items-center rounded-2xl bg-secondary/50 border border-border/50 px-4 py-1">
          <Search size={20} color="#64748b" />
          <TextInput
            placeholder="Search friends..."
            placeholderTextColor="#94a3b8"
            className="ml-3 h-12 flex-1 text-base text-foreground"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-2">
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-1">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              My Friends {friends?.length > 0 && `(${friends.length})`}
            </Text>
          </View>

          {loadingFriends ? (
            <View className="mt-10 items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border bg-secondary/20 p-10">
                  <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary/50 mb-4">
                    <Users size={32} color="#94a3b8" />
                  </View>
                  <Text className="text-center text-lg font-bold text-foreground">
                    {searchQuery ? 'No friends found' : 'No friends yet'}
                  </Text>
                  <Text className="mt-2 text-center text-sm text-muted-foreground">
                    {searchQuery 
                      ? `We couldn't find anyone matching "${searchQuery}"`
                      : 'Connect with people nearby to see them here!'}
                  </Text>
                  {!searchQuery && (
                    <TouchableOpacity
                      onPress={() => router.push('/users')}
                      activeOpacity={0.7}
                      className="mt-8 rounded-full bg-primary px-8 py-3 shadow-sm shadow-primary/20">
                      <Text className="font-bold text-primary-foreground">Discover People</Text>
                    </TouchableOpacity>
                  )}
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
