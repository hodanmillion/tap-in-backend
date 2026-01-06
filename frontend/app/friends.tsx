import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MessageSquare } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function FriendsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: friends, isLoading, refetch } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/friends/${user.id}`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen 
        options={{ 
          title: 'My Friends',
          headerShown: true,
          headerStyle: { backgroundColor: '#09090b' },
          headerTitleStyle: { color: '#ffffff', fontSize: 17, fontWeight: '600' as any },
          headerTintColor: '#3b82f6',
          headerShadowVisible: false,
        }} 
      />
      <View className="flex-1 px-6">
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
