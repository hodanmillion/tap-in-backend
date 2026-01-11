import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Users, ChevronLeft, ArrowRight } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function FriendsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const {
    data: friends,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/${user.id}`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  const renderFriend = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => {
        router.push(`/chat/private_${item.id}`);
      }}
      className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4 shadow-sm active:opacity-70">
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-secondary/50">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="h-16 w-16" />
        ) : (
          <Users size={28} color={theme.mutedForeground} opacity={0.3} />
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-foreground">
          {item.full_name || item.username || 'Anonymous'}
        </Text>
        <Text className="text-sm font-medium text-muted-foreground">@{item.username || 'user'}</Text>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare size={18} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className="flex-1 px-6">
        <View className="mb-8 mt-6 flex-row items-center gap-4">
           <TouchableOpacity 
             onPress={() => router.back()}
             className="h-12 w-12 items-center justify-center rounded-2xl bg-secondary border border-border">
             <ChevronLeft size={24} color={theme.foreground} />
           </TouchableOpacity>
           <View>
             <Text className="text-4xl font-black tracking-tight text-foreground">Friends</Text>
             <Text className="text-base font-medium text-muted-foreground">Your inner circle.</Text>
           </View>
        </View>

        {isLoading && !isFetching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriend}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border p-10">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary mb-6">
                  <Users size={32} color={theme.mutedForeground} opacity={0.3} />
                </View>
                <Text className="text-center text-xl font-black text-foreground">No friends yet</Text>
                <Text className="mt-2 text-center text-sm font-medium text-muted-foreground">
                  Connect with people in the Discover tab to build your network!
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
