import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatsScreen() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchMyRooms();
  }, []);

  async function fetchMyRooms() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch rooms where the user has sent messages (past history)
    const { data: messages } = await supabase
      .from('messages')
      .select('room_id, chat_rooms(*)')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false });

    // Deduplicate rooms
    const uniqueRooms = Array.from(
      new Map(messages?.map((m) => [m.room_id, m.chat_rooms])).values()
    ).filter(Boolean);

    setRooms(uniqueRooms);
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Chat History</Text>
          <Text className="text-sm text-muted-foreground">
            Your past conversations and active groups.
          </Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
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
