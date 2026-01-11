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
import { useLocation } from '@/hooks/useLocation';
import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Clock, MapPin, Search, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function UsersScreen() {
  const { user } = useAuth();
  const { location } = useLocation(user?.id);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data: nearbyUsers,
    isLoading: loadingNearby,
    refetch: refetchNearby,
  } = useQuery({
    queryKey: ['nearbyUsers', location?.coords.latitude, location?.coords.longitude],
    queryFn: async () => {
      if (!location || !user?.id) return [];
      const { latitude, longitude } = location.coords;
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/profiles/nearby?lat=${latitude}&lng=${longitude}&radius=5000&userId=${user.id}`
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!location && !!user?.id && !debouncedQuery,
  });

  const { data: searchResults, isLoading: loadingSearch } = useQuery({
    queryKey: ['userSearch', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || !user?.id) return [];
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/profiles/search?q=${encodeURIComponent(
          debouncedQuery
        )}&userId=${user.id}`
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!debouncedQuery && !!user?.id,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: user?.id, receiver_id: receiverId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send request');
      }
      return receiverId;
    },
    onSuccess: (receiverId) => {
      setSentRequests((prev) => new Set([...prev, receiverId]));
      Alert.alert('Success', 'Friend request sent!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const renderUser = ({ item }: { item: any }) => (
    <View className="mb-4 flex-row items-center rounded-3xl border border-border/50 bg-card p-4 shadow-sm">
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary/50">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="h-16 w-16" />
        ) : (
          <Text className="text-2xl font-bold text-muted-foreground/50">
            {item.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-foreground">
          {item.full_name || item.username || 'Anonymous'}
        </Text>
        <View className="mt-1 flex-row items-center">
          {item.latitude ? (
            <>
              <MapPin size={12} color="#3b82f6" />
              <Text className="ml-1 text-xs font-medium text-blue-500">Nearby</Text>
            </>
          ) : (
            <Text className="text-xs text-muted-foreground">@{item.username}</Text>
          )}
        </View>
      </View>

      {sentRequests.has(item.id) ? (
        <View className="flex-row items-center rounded-full bg-secondary/80 px-4 py-2">
          <Clock size={14} color="#9ca3af" />
          <Text className="ml-2 text-xs font-bold text-muted-foreground">Pending</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => sendRequestMutation.mutate(item.id)}
          disabled={sendRequestMutation.isPending}
          activeOpacity={0.7}
          className="rounded-full bg-primary px-5 py-2.5 shadow-sm shadow-primary/20">
          <Text className="text-xs font-bold text-primary-foreground">
            {sendRequestMutation.isPending ? '...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const displayData = debouncedQuery ? searchResults : nearbyUsers;
  const isLoading = debouncedQuery ? loadingSearch : loadingNearby;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-4xl font-extrabold tracking-tight text-foreground">Discover</Text>
          <Text className="mt-1 text-base text-muted-foreground">
            Find people nearby or search by name.
          </Text>
        </View>

        <View className="mb-6 flex-row items-center rounded-2xl bg-secondary/50 border border-border/50 px-4 py-1">
          <Search size={20} color="#64748b" />
          <TextInput
            placeholder="Search for people..."
            placeholderTextColor="#94a3b8"
            className="ml-3 h-12 flex-1 text-base text-foreground"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-2">
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {debouncedQuery ? 'Search Results' : 'People Nearby'}
          </Text>
          {!debouncedQuery && (
            <Text className="text-xs font-medium text-blue-500">
              Within 5km
            </Text>
          )}
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={displayData}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border bg-secondary/20 p-10">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary/50 mb-4">
                  <Search size={32} color="#94a3b8" />
                </View>
                <Text className="text-center text-lg font-bold text-foreground">
                  {debouncedQuery ? 'No one found' : 'No one nearby yet'}
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  {debouncedQuery 
                    ? `We couldn't find any users matching "${debouncedQuery}"`
                    : 'Try moving to a busier area or check back later!'}
                </Text>
              </View>
            }
            onRefresh={!debouncedQuery ? refetchNearby : undefined}
            refreshing={!debouncedQuery && isLoading}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
