import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from '@/hooks/useLocation';
import { useState, useEffect } from 'react';
import { UserPlus, Clock, MapPin, Search, X, Users, MessageCircle, Compass, WifiOff, RefreshCw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { formatGeographicDistance } from '@/lib/utils';

const UserItemSkeleton = () => (
  <View className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4 opacity-50">
    <View className="h-14 w-14 rounded-2xl bg-secondary/60" />
    <View className="ml-4 flex-1 gap-2">
      <View className="h-4 w-32 rounded bg-secondary/60" />
      <View className="h-3 w-20 rounded bg-secondary/60" />
    </View>
    <View className="h-10 w-24 rounded-xl bg-secondary/60" />
  </View>
);

export default function UsersScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const { location, lastSyncTime } = useLocation(user?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

    const {
      data: nearbyUsers,
      isLoading: loadingNearby,
      isError: nearbyError,
      error: nearbyErrorMsg,
      refetch: refetchNearby,
    } = useQuery({
      queryKey: [
        'nearbyUsers',
        location?.coords.latitude.toFixed(2),
        location?.coords.longitude.toFixed(2),
        lastSyncTime,
      ],
      queryFn: async () => {
        if (!location || !user?.id) return [];
        const { latitude, longitude } = location.coords;
        return apiRequest(
          `/profiles/nearby?lat=${latitude}&lng=${longitude}&radius=5000&userId=${user.id}`
        );
      },
    enabled: !!location && !!user?.id && !debouncedQuery,
    staleTime: 30000,
    gcTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });
  
    const { data: searchResults, isLoading: loadingSearch, isError: searchError, error: searchErrorMsg } = useQuery({
      queryKey: ['userSearch', debouncedQuery],
      queryFn: async () => {
        if (!debouncedQuery || !user?.id) return [];
        const lat = location?.coords.latitude;
        const lng = location?.coords.longitude;
        const url = `/profiles/search?q=${encodeURIComponent(debouncedQuery)}&userId=${user.id}${lat ? `&lat=${lat}&lng=${lng}&radius=10000` : ''}`;
        return apiRequest(url);
      },
    enabled: !!debouncedQuery && !!user?.id,
    staleTime: 30000,
    gcTime: 1000 * 60 * 5,
  });



  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: user?.id, receiver_id: receiverId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send request');
      }
      return receiverId;
    },
    onSuccess: (receiverId) => {
      setSentRequests((prev) => new Set([...prev, receiverId]));
      Alert.alert('Success', 'Friend request sent!');
      queryClient.invalidateQueries({ queryKey: ['nearbyUsers'] });
      queryClient.invalidateQueries({ queryKey: ['userSearch'] });
    },
    onError: (error: Error) => {
      Alert.alert('Cannot Connect', error.message);
      queryClient.invalidateQueries({ queryKey: ['nearbyUsers'] });
      queryClient.invalidateQueries({ queryKey: ['userSearch'] });
    },
  });

  const renderUser = ({ item }: { item: any }) => {
    const isSent = sentRequests.has(item.id) || item.connection_status === 'pending';
    const isConnected = item.connection_status === 'accepted' || item.has_private_room === true;

    return (
      <View className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4 shadow-sm">
        <TouchableOpacity 
          onPress={() => router.push(`/user/${item.id}`)}
          className="flex-row items-center flex-1">
          <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/5">
            {item.avatar_url ? (
              <Image 
                source={{ uri: item.avatar_url }} 
                style={{ width: 56, height: 56 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <Users size={24} color={theme.primary} />
            )}
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold text-foreground leading-tight" numberOfLines={1}>
              {item.full_name || item.username || 'Anonymous'}
            </Text>
              <View className="mt-1 flex-row items-center">
                {item.latitude ? (
                  <View className="flex-row items-center bg-green-500/10 px-2 py-0.5 rounded-full">
                    <View className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5" />
                    <Text className="text-[9px] font-bold uppercase text-green-600 tracking-wider">
                      {item.distance != null ? formatGeographicDistance(item.distance) : 'Nearby'}
                    </Text>
                  </View>
                ) : (
                <Text className="text-xs font-semibold text-muted-foreground">@{item.username}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {isConnected ? (
          <TouchableOpacity
            onPress={() => router.push(`/chat/private_${item.id}`)}
            activeOpacity={0.7}
            className="rounded-xl bg-secondary px-4 py-2.5 shadow-sm border border-border/50">
            <View className="flex-row items-center">
              <MessageCircle size={14} color={theme.primary} />
              <Text className="ml-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">Chat</Text>
            </View>
          </TouchableOpacity>
        ) : isSent ? (
          <View className="flex-row items-center rounded-xl bg-secondary/50 px-3 py-2 border border-border/50">
            <Clock size={14} color={theme.mutedForeground} />
            <Text className="ml-1.5 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Sent</Text>
          </View>
          ) : (
            <TouchableOpacity
              onPress={() => sendRequestMutation.mutate(item.id)}
              disabled={sendRequestMutation.isPending}
              activeOpacity={0.8}
              className="rounded-xl overflow-hidden shadow-md shadow-primary/30">
              <LinearGradient
                colors={['#8b5cf6', '#6d28d9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="px-5 py-2.5 items-center justify-center">
                {sendRequestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-[11px] font-black uppercase tracking-wider text-white">
                    Connect
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
      </View>
    );
  };

  const filteredNearbyUsers = nearbyUsers || [];
  const filteredSearchResults = searchResults || [];
  const displayData = debouncedQuery ? filteredSearchResults : filteredNearbyUsers;
  const isLoading = debouncedQuery ? loadingSearch : loadingNearby;
  const isError = debouncedQuery ? searchError : nearbyError;
  const errorMsg = debouncedQuery ? searchErrorMsg : nearbyErrorMsg;

    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 px-5">
          {!user?.id ? (
            <View className="mt-20 items-center justify-center rounded-[40px] border-2 border-dashed border-border/60 bg-secondary/50 p-12">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-background border border-border mb-8 shadow-sm">
                <Compass size={40} color={theme.mutedForeground} opacity={0.4} />
              </View>
              <Text className="text-center text-2xl font-black text-foreground">
                Discover Nearby
              </Text>
              <Text className="mt-3 text-center text-base font-medium text-muted-foreground px-4">
                Sign in to see people nearby and start connecting with your local community.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/login')}
                activeOpacity={0.8}
                className="mt-8 flex-row items-center gap-2 rounded-2xl bg-primary px-8 py-4 shadow-lg shadow-primary/30">
                <Text className="font-bold text-white text-lg">Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="mb-6 mt-6">
                <Text className="text-3xl font-black tracking-tight text-foreground">Discover</Text>
                <Text className="mt-1 text-sm font-semibold text-muted-foreground">
                  Connect with people in your area
                </Text>
              </View>

              <View className="mb-8 flex-row items-center rounded-2xl bg-secondary/30 border border-border/50 px-4 py-1">
                <Search size={18} color={theme.mutedForeground} />
                <TextInput
                  placeholder="Search by username..."
                  placeholderTextColor={theme.mutedForeground}
                  className="ml-3 h-12 flex-1 text-base font-semibold text-foreground"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
                    <X size={16} color={theme.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {debouncedQuery ? 'Search Results' : 'Nearby People'}
                </Text>
                {!debouncedQuery && location && (
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    <Text className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      5km Radius
                    </Text>
                  </View>
                )}
              </View>

              {isLoading ? (
                <View className="flex-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <UserItemSkeleton key={i} />
                  ))}
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
                    {(errorMsg as Error)?.message || 'Unable to discover people. Check your connection.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => refetchNearby()}
                    activeOpacity={0.8}
                    className="mt-6 flex-row items-center gap-2 rounded-2xl bg-primary px-6 py-3">
                    <RefreshCw size={18} color={theme.primaryForeground} />
                    <Text className="text-sm font-bold text-primary-foreground">Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlashList
                  data={displayData}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUser}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 120 }}
                  ListEmptyComponent={
                    !isLoading ? (
                      <View className="mt-10 items-center justify-center rounded-[40px] border-2 border-dashed border-border/60 bg-secondary/50 p-12">
                        <View className="h-24 w-24 items-center justify-center rounded-full bg-background border border-border mb-8 shadow-sm">
                          <Compass size={40} color={theme.mutedForeground} opacity={0.4} />
                        </View>
                        <Text className="text-center text-2xl font-black text-foreground">
                          {debouncedQuery ? 'No users found' : 'Silence is golden'}
                        </Text>
                        <Text className="mt-3 text-center text-base font-medium text-muted-foreground px-4">
                          {debouncedQuery
                            ? `We couldn't find anyone matching "${debouncedQuery}"`
                            : "No one else is nearby right now. Be the first to start a conversation!"}
                        </Text>
                      </View>
                    ) : null
                  }
                  onRefresh={!debouncedQuery ? refetchNearby : undefined}
                  refreshing={false}
                />
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }
