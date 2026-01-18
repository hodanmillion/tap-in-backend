import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  ChevronLeft,
  Briefcase,
  MapPin,
  Globe,
  MessageCircle,
  UserPlus,
  Clock,
  Check,
  Linkedin,
  Instagram,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, BACKEND_URL } from '@/lib/api';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: friendStatus } = useQuery({
    queryKey: ['friend-status', user?.id, id],
    queryFn: async () => {
      if (!user?.id || !id) return 'none';
      
      const { data: friend } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id_1.eq.${user.id},user_id_2.eq.${id}),and(user_id_1.eq.${id},user_id_2.eq.${user.id})`)
        .single();
      
      if (friend) return 'friends';
      
      const { data: request } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${user.id})`)
        .eq('status', 'pending')
        .single();
      
      if (request) {
        return request.sender_id === user.id ? 'sent' : 'received';
      }
      
      return 'none';
    },
    enabled: !!user?.id && !!id,
  });

  const { data: friendCount = 0 } = useQuery({
    queryKey: ['friend-count', id],
    queryFn: async () => {
      if (!id) return 0;
      const { count, error } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .or(`user_id_1.eq.${id},user_id_2.eq.${id}`);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BACKEND_URL}/friend-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: user?.id, receiverId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send request');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-status', user?.id, id] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const goToChat = () => {
    router.push(`/chat/private_${id}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator color={theme.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <Text className="text-foreground">User not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-border/30">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-card">
          <ChevronLeft size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-foreground mr-10">Profile</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn} className="items-center px-5 pt-6 pb-6">
          <View className="h-28 w-28 rounded-full overflow-hidden bg-card border-4 border-background">
            {profile?.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <LinearGradient
                colors={['#8b5cf6', '#6366f1']}
                className="flex-1 items-center justify-center">
                <User size={48} color="#fff" />
              </LinearGradient>
            )}
          </View>
          
          <Text className="mt-5 text-2xl font-black text-foreground text-center">
            {profile?.full_name || 'Anonymous'}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground font-medium">
            @{profile?.username || 'user'}
          </Text>

          <View className="flex-row items-center gap-6 mt-5">
            <View className="items-center">
              <Text className="text-xl font-black text-foreground">{friendCount}</Text>
              <Text className="text-xs text-muted-foreground font-medium">Friends</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-5">
            {friendStatus === 'friends' ? (
              <TouchableOpacity 
                onPress={goToChat}
                className="flex-row items-center gap-2 bg-primary px-5 py-2.5 rounded-full">
                <MessageCircle size={16} color="#fff" />
                <Text className="text-sm font-bold text-white">Message</Text>
              </TouchableOpacity>
            ) : friendStatus === 'sent' ? (
              <View className="flex-row items-center gap-2 bg-card border border-border px-5 py-2.5 rounded-full">
                <Clock size={16} color={theme.mutedForeground} />
                <Text className="text-sm font-bold text-muted-foreground">Request Sent</Text>
              </View>
            ) : friendStatus === 'received' ? (
              <View className="flex-row items-center gap-2 bg-green-500/10 border border-green-500/30 px-5 py-2.5 rounded-full">
                <Check size={16} color="#22c55e" />
                <Text className="text-sm font-bold text-green-500">Accept Request</Text>
              </View>
            ) : (
              <TouchableOpacity 
                onPress={() => sendRequestMutation.mutate()}
                disabled={sendRequestMutation.isPending}
                className="flex-row items-center gap-2 bg-primary px-5 py-2.5 rounded-full">
                {sendRequestMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <UserPlus size={16} color="#fff" />
                    <Text className="text-sm font-bold text-white">Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <View className="px-5 gap-4">
          <View className="rounded-2xl bg-card border border-border/40 p-5">
            <Text className="text-sm font-bold text-muted-foreground mb-2">Bio</Text>
            <Text className="text-base text-foreground leading-6">
              {profile?.bio || "This user hasn't added a bio yet."}
            </Text>
          </View>
          
          {(profile?.occupation || profile?.location_name || profile?.website || profile?.linkedin_url || profile?.instagram_url) && (
            <View className="rounded-2xl bg-card border border-border/40 p-5 gap-4">
              {profile?.occupation && (
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mr-4">
                    <Briefcase size={18} color={theme.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground font-medium">Occupation</Text>
                    <Text className="text-base font-semibold text-foreground">{profile.occupation}</Text>
                  </View>
                </View>
              )}
              
              {profile?.location_name && (
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 mr-4">
                    <MapPin size={18} color="#10b981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground font-medium">Location</Text>
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{profile.location_name}</Text>
                  </View>
                </View>
              )}
              
              {profile?.website && (
                <TouchableOpacity 
                  onPress={() => Linking.openURL(profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)}
                  className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 mr-4">
                    <Globe size={18} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground font-medium">Website</Text>
                    <Text className="text-base font-semibold text-primary">{profile.website}</Text>
                  </View>
                </TouchableOpacity>
              )}

              {profile?.linkedin_url && (
                <TouchableOpacity 
                  onPress={() => {
                    const url = profile.linkedin_url.startsWith('http') 
                      ? profile.linkedin_url 
                      : `https://linkedin.com/in/${profile.linkedin_url.replace(/^@/, '')}`;
                    Linking.openURL(url);
                  }}
                  className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#0077B5]/10 mr-4">
                    <Linkedin size={18} color="#0077B5" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground font-medium">LinkedIn</Text>
                    <Text className="text-base font-semibold text-[#0077B5]">{profile.linkedin_url}</Text>
                  </View>
                </TouchableOpacity>
              )}

              {profile?.instagram_url && (
                <TouchableOpacity 
                  onPress={() => {
                    const username = profile.instagram_url.replace(/^@/, '').replace('instagram.com/', '');
                    Linking.openURL(`https://instagram.com/${username}`);
                  }}
                  className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#E4405F]/10 mr-4">
                    <Instagram size={18} color="#E4405F" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground font-medium">Instagram</Text>
                    <Text className="text-base font-semibold text-[#E4405F]">{profile.instagram_url}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View className="h-32" />
      </ScrollView>
    </SafeAreaView>
  );
}
