import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Clock, ChevronRight, Hash, MessageSquare } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function ChatsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const {
    data: rooms,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['myChatRooms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: participants, error } = await supabase
        .from('room_participants')
        .select('room_id, chat_rooms(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      return (participants || [])
        .map((p) => p.chat_rooms as any)
        .filter((r: any) => r !== null && typeof r === 'object' && 'id' in r)
        .filter((r: any) => r.name !== 'Ottawa Tech Hub')
        .sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
    },
    enabled: !!user?.id,
  });

  const renderRoom = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/chat/${item.id}`)}
      className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4 shadow-sm active:opacity-70">
      <View
        className={`h-16 w-16 items-center justify-center rounded-2xl ${
          item.type === 'private' ? 'bg-primary/10' : 'bg-secondary'
        }`}>
        {item.type === 'private' ? (
          <MessageCircle size={28} color={theme.primary} />
        ) : (
          <Hash size={28} color={theme.mutedForeground} />
        )}
      </View>
      <View className="ml-4 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center justify-between">
           <View className="flex-row items-center">
             <Clock size={12} color={theme.mutedForeground} />
             <Text className="ml-1 text-xs font-medium text-muted-foreground">
               {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Active'}
             </Text>
           </View>
           <View className={`px-2 py-0.5 rounded-full ${item.type === 'private' ? 'bg-primary' : 'bg-secondary'}`}>
             <Text className={`text-[9px] font-black uppercase tracking-tighter ${item.type === 'private' ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
               {item.type}
             </Text>
           </View>
        </View>
      </View>
      <View className="ml-3">
        <ChevronRight size={18} color={theme.mutedForeground} opacity={0.3} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-8 mt-6">
          <Text className="text-4xl font-black tracking-tight text-foreground">Messages</Text>
          <Text className="mt-1 text-base font-medium text-muted-foreground">
            Your private and nearby chats.
          </Text>
        </View>

        {isLoading && !isFetching ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            onRefresh={refetch}
            refreshing={isFetching}
            renderItem={renderRoom}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-3xl border border-dashed border-border p-10">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary mb-6">
                  <MessageSquare size={32} color={theme.mutedForeground} opacity={0.3} />
                </View>
                <Text className="text-center text-xl font-black text-foreground">
                  No chats found
                </Text>
                <Text className="mt-2 text-center text-sm font-medium text-muted-foreground">
                  Start a conversation by joining a nearby zone or connecting with friends!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
