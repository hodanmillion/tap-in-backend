import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { User, MessageCircle, Heart, ChevronRight, UserPlus, Compass } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function FriendsScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const { data: friends, isLoading } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          friend:profiles!friendships_friend_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      if (error) throw error;
      return data.map((f: any) => f.friend);
    },
    enabled: !!user?.id,
  });

  const renderFriend = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/chat/${item.id}`)}
      className="mb-4 flex-row items-center rounded-3xl border border-border bg-card p-4 shadow-sm active:bg-secondary/10">
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/5">
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} className="h-14 w-14" />
        ) : (
          <User size={24} color={theme.primary} />
        )}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-bold text-foreground leading-tight">
          {item.full_name || item.username}
        </Text>
        <Text className="text-xs font-semibold text-muted-foreground mt-1">@{item.username}</Text>
      </View>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary/50">
        <MessageCircle size={18} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-5">
        <View className="mb-8 mt-6 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black tracking-tight text-foreground">Friends</Text>
            <Text className="mt-1 text-sm font-semibold text-muted-foreground">
              Your inner circle
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/users')}
            activeOpacity={0.8}
            className="h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/20">
            <UserPlus size={22} color={theme.primaryForeground} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriend}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View className="mt-10 items-center justify-center rounded-[40px] border-2 border-dashed border-border/60 bg-secondary/50 p-12">
                <View className="h-24 w-24 items-center justify-center rounded-full bg-background border border-border mb-8 shadow-sm">
                  <Heart size={40} color={theme.mutedForeground} opacity={0.4} />
                </View>
                <Text className="text-center text-2xl font-black text-foreground">
                  No friends yet
                </Text>
                <Text className="mt-3 text-center text-base font-medium text-muted-foreground px-4">
                  Find interesting people nearby and start building your circle!
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/users')}
                  activeOpacity={0.8}
                  className="mt-8 flex-row items-center gap-2 rounded-2xl bg-primary px-8 py-4">
                  <Compass size={20} color={theme.primaryForeground} />
                  <Text className="font-black text-primary-foreground uppercase tracking-widest">Explore</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
