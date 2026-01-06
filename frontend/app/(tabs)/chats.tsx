import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function ChatsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: rooms, isLoading, refetch } = useQuery({
    queryKey: ['myChatRooms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: participants, error } = await supabase
        .from('room_participants')
        .select('room_id, chat_rooms(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      return (participants || [])
        .map(p => p.chat_rooms as any)
        .filter((r: any) => r !== null && typeof r === 'object' && 'id' in r)
        .filter((r: any) => r.name !== 'Ottawa Tech Hub')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    },
    enabled: !!user?.id,
  });

  const renderRoom = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/chat/${item.id}`)}
      className="mb-4 flex-row items-center rounded-3xl bg-card p-4 shadow-sm border border-border/50"
    >
      <View className={`h-14 w-14 items-center justify-center rounded-full ${item.type === 'private' ? 'bg-primary/10' : 'bg-secondary'}`}>
        <MessageSquare size={24} color={item.type === 'private' ? '#3b82f6' : '#6b7280'} />
      </View>
      <View className="ml-4 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-[10px] text-muted-foreground uppercase">
            {item.type}
          </Text>
        </View>
        <View className="flex-row items-center mt-1">
          <Clock size={12} color="#9ca3af" />
          <Text className="ml-1 text-xs text-muted-foreground">
            {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Active recently'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold text-foreground">Messages</Text>
          <Text className="text-sm text-muted-foreground">
            Your conversations and groups.
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
            renderItem={renderRoom}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center p-10 bg-secondary/20 rounded-3xl border border-dashed border-border">
                <MessageSquare size={40} color="#9ca3af" />
                <Text className="mt-4 text-center text-lg font-semibold text-muted-foreground">
                  No conversations yet.
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  Join a nearby chat or start a private message with a friend!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
