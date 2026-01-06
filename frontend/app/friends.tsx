import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FriendsScreen() {
  const [userId, setUserId] = useState<string | undefined>();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  const { data: friends, isLoading, refetch } = useQuery({
    queryKey: ['friends', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/${userId}`);
      return response.json();
    },
    enabled: !!userId,
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="#3b82f6" />
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">My Friends</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  // Navigate to private chat (Task 3)
                  router.push(`/chat/private_${item.id}`);
                }}
                className="mb-4 flex-row items-center rounded-2xl bg-card p-4 shadow-sm"
              >
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
                <View className="rounded-full bg-primary/10 p-2">
                  <MessageSquare size={20} color="#3b82f6" />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center p-10">
                <Text className="text-center text-lg text-muted-foreground">
                  No friends yet.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Go to the Discover tab to find people nearby!
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
