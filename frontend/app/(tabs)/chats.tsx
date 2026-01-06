import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';

export default function ChatsScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const { data: rooms, isLoading, refetch } = useQuery({
    queryKey: ['myChatRooms', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Fetch rooms through participants table - much more efficient
      const { data: participants, error } = await supabase
        .from('room_participants')
        .select('room_id, chat_rooms(*)')
        .eq('user_id', userId);

      if (error) throw error;

      // Extract and filter valid rooms
      const uniqueRooms = (participants || [])
        .map(p => p.chat_rooms)
        .filter(Boolean)
        .filter((r: any) => r.name !== 'Ottawa Tech Hub');

      return uniqueRooms;
    },
    enabled: !!userId,
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Chat History</Text>
          <Text className="text-sm text-muted-foreground">
            Your past conversations and active groups.
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            onRefresh={refetch}
            refreshing={isLoading}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item.id}`)}
                className="mb-4 flex-row items-center rounded-2xl bg-card p-4 shadow-sm"
              >
                <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <MessageSquare size={24} color="#6b7280" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-semibold text-foreground">
                    {item.name}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color="#9ca3af" />
                    <Text className="text-xs text-muted-foreground">
                      Last active recently
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center p-10">
                <Text className="text-center text-lg text-muted-foreground">
                  No chat history yet.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Join a nearby chat to get started!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
