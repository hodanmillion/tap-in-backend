import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Clock, ChevronRight, Hash, MessageSquare, Compass, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function ChatsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const { location } = useLocation(user?.id);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  const {
    data: rooms,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['myChatRooms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // 1. Get all rooms I'm a participant in
      const { data: myParticipations, error: partError } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!myParticipations || myParticipations.length === 0) return [];

      const roomIds = myParticipations.map(p => p.room_id);

      // 2. Get the room details and ALL participants for those rooms (to find the other person in private chats)
      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          room_participants(
            user_id,
            profiles(full_name, username, avatar_url)
          )
        `)
        .in('id', roomIds);

      if (roomsError) throw roomsError;

      return (roomsData || [])
        .map((room: any) => {
          if (room.type === 'private') {
            const otherParticipant = room.room_participants?.find(
              (p: any) => p.user_id !== user.id
            );
            const profile = otherParticipant?.profiles;
            return {
              ...room,
              name: profile?.full_name || `@${profile?.username}` || 'Private Chat',
              other_user_avatar: profile?.avatar_url,
            };
          }
          return room;
        })
        .sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
    },
    enabled: !!user?.id,
  });

  const renderRoom = ({ item }: { item: any }) => {
    const isOutOfRange = 
      item.type === 'auto_generated' && 
      location && 
      calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        item.latitude,
        item.longitude
      ) > (item.radius || 20);

    const isExpired = item.expires_at && new Date() > new Date(item.expires_at);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/chat/${item.id}`)}
        className="mb-5 flex-row items-center rounded-[28px] border border-border bg-card p-5 shadow-sm">
        <View
          className={`h-16 w-16 items-center justify-center rounded-[20px] overflow-hidden ${
            item.type === 'private' ? 'bg-primary/10' : 'bg-secondary/50'
          }`}>
          {item.type === 'private' ? (
            item.other_user_avatar ? (
              <Image source={{ uri: item.other_user_avatar }} className="h-full w-full" />
            ) : (
              <MessageCircle size={30} color={theme.primary} />
            )
          ) : (
            <Hash size={30} color={theme.mutedForeground} />
          )}
        </View>
        <View className="ml-4 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground flex-1 mr-2" numberOfLines={1}>
              {item.name}
            </Text>
            {(isOutOfRange || isExpired) && item.type !== 'private' && (
              <View className="flex-row items-center bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                <Lock size={10} color={theme.mutedForeground} className="mr-1" />
                <Text className="text-[10px] font-bold text-muted-foreground uppercase">Read Only</Text>
              </View>
            )}
          </View>
          <View className="mt-1 flex-row items-center justify-between">
             <View className="flex-row items-center">
               <Clock size={12} color={theme.mutedForeground} />
               <Text className="ml-1.5 text-xs font-semibold text-muted-foreground">
                 {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Active'}
               </Text>
             </View>
             <View className={`px-2.5 py-1 rounded-full ${item.type === 'private' ? 'bg-primary/10' : 'bg-secondary'}`}>
               <Text className={`text-[10px] font-black uppercase tracking-widest ${item.type === 'private' ? 'text-primary' : 'text-muted-foreground'}`}>
                 {item.type}
               </Text>
             </View>
          </View>
        </View>
        <View className="ml-3 h-11 w-11 items-center justify-center rounded-full bg-secondary">
          <ChevronRight size={18} color={theme.mutedForeground} opacity={0.5} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6">
        <View className="mb-8 mt-8">
          <Text className="text-4xl font-black tracking-tight text-foreground">Messages</Text>
          <Text className="mt-2 text-base font-semibold text-muted-foreground">
            Your active conversations.
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
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-[40px] border-2 border-dashed border-border/60 bg-secondary/50 p-12">
                <View className="h-24 w-24 items-center justify-center rounded-full bg-background border border-border mb-8 shadow-sm">
                  <MessageSquare size={40} color={theme.mutedForeground} opacity={0.4} />
                </View>
                <Text className="text-center text-2xl font-black text-foreground">
                  Empty inbox
                </Text>
                <Text className="mt-3 text-center text-base font-medium text-muted-foreground px-4">
                  Start a conversation by joining a nearby zone or connecting with friends!
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/home')}
                  activeOpacity={0.8}
                  className="mt-8 flex-row items-center gap-2 rounded-2xl bg-primary px-8 py-4">
                  <Compass size={20} color={theme.primaryForeground} />
                  <Text className="font-black text-primary-foreground uppercase tracking-widest">Find Zones</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
