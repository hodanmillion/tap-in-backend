import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

import { 
  User, 
  LogOut, 
  Settings, 
  Bell, 
  Shield, 
  Users, 
  ChevronRight, 
  Share2, 
  Compass, 
  Heart,
  Briefcase,
  MapPin,
  Globe,
  Camera,
  MessageSquare,
  Clock,
  Pencil,
  Linkedin,
  Instagram,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type Tab = 'About' | 'Activity';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'dark'];
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('About');
  const [uploading, setUploading] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const profile = profileQuery.data;
  const refetchProfile = profileQuery.refetch;

  const { data: friendCount = 0 } = useQuery({
    queryKey: ['friend-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const { data: messageCount = 0 } = useQuery({
    queryKey: ['message-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['profile-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('room_participants')
        .select(`
          joined_at,
          chat_rooms (
            id,
            name,
            type
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!user?.id) throw new Error('User not logged in');
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      refetchProfile();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
    },
  });

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets[0].uri) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user?.id) return;
    
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}.jpg`;
      
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfileMutation.mutateAsync({ avatar_url: `${publicUrl}?v=${Date.now()}` });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Error', error.message);
          else router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const handleInvite = async () => {
    try {
      await Share.share({
        message: `Check out Tap In! Connect with people and discover what's happening right where you are. Download now!`,
        title: 'Join Tap In',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUpdateProfile = () => {
    router.push('/edit-profile');
  };

  if (authLoading || profileQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator color={theme.primary} size="large" />
      </SafeAreaView>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'About':
        return (
          <Animated.View entering={FadeIn} className="px-5 gap-4">
            <View className="rounded-2xl bg-card border border-border/40 p-5">
              <Text className="text-sm font-bold text-muted-foreground mb-2">Bio</Text>
              <Text className="text-base text-foreground leading-6">
                {profile?.bio || "No bio yet. Add one to tell others about yourself!"}
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
                    <View className="flex-row items-center">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 mr-4">
                        <Globe size={18} color="#3b82f6" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-muted-foreground font-medium">Website</Text>
                        <Text className="text-base font-semibold text-primary">{profile.website}</Text>
                      </View>
                    </View>
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
          </Animated.View>
        );
      case 'Activity':
        if (activityLoading) {
          return (
            <View className="px-5 py-16 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          );
        }
        return (
          <Animated.View entering={FadeIn} className="px-5 gap-3">
            {activity && activity.length > 0 ? (
              activity.map((item: any, index: number) => (
                <Animated.View key={index} entering={FadeInDown.delay(index * 50)}>
                  <View className="flex-row items-center bg-card border border-border/40 p-4 rounded-2xl">
                    <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mr-4">
                      <MessageSquare size={20} color={theme.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {item.chat_rooms?.name || 'Chat Room'}
                      </Text>
                      <View className="flex-row items-center mt-1 gap-1">
                        <Clock size={11} color={theme.mutedForeground} />
                        <Text className="text-xs text-muted-foreground">
                          {new Date(item.joined_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))
            ) : (
              <View className="items-center justify-center py-16">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border mb-4">
                  <Compass size={28} color={theme.mutedForeground} />
                </View>
                <Text className="text-lg font-bold text-foreground">No Activity</Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground px-8">
                  Your recent activity will appear here
                </Text>
              </View>
            )}
            </Animated.View>
          );
      }
    };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn} className="items-center px-5 pt-6 pb-6">
          <View className="relative">
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              activeOpacity={0.9}
              className="h-28 w-28 rounded-full overflow-hidden bg-card border-4 border-background">
              {uploading ? (
                <View className="flex-1 items-center justify-center bg-card">
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : profile?.avatar_url ? (
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
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full bg-primary border-3 border-background">
              <Camera size={16} color="#fff" />
            </TouchableOpacity>
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
            <View className="h-8 w-px bg-border" />
            <View className="items-center">
              <Text className="text-xl font-black text-foreground">{messageCount}</Text>
              <Text className="text-xs text-muted-foreground font-medium">Messages</Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleUpdateProfile}
            className="mt-5 flex-row items-center gap-2 bg-card border border-border/50 px-5 py-2.5 rounded-full">
            <Pencil size={14} color={theme.foreground} />
            <Text className="text-sm font-bold text-foreground">Edit Profile</Text>
          </TouchableOpacity>
        </Animated.View>

        <View className="flex-row px-5 mb-5">
          {(['About', 'Activity'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 items-center py-3 rounded-xl mr-2 last:mr-0 ${
                activeTab === tab ? 'bg-primary' : 'bg-card border border-border/40'
              }`}>
              <Text
                className={`text-sm font-bold ${
                  activeTab === tab ? 'text-white' : 'text-muted-foreground'
                }`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderTabContent()}

        <View className="px-5 mt-8 gap-3">
          <TouchableOpacity
            onPress={() => router.push('/friends')}
            activeOpacity={0.7}
            className="flex-row items-center p-4 rounded-2xl bg-card border border-border/40">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10">
              <Heart size={18} color="#ec4899" />
            </View>
            <Text className="ml-4 flex-1 text-base font-semibold text-foreground">Friends</Text>
            <ChevronRight size={18} color={theme.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleInvite}
            activeOpacity={0.7}
            className="flex-row items-center p-4 rounded-2xl bg-card border border-border/40">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Share2 size={18} color="#3b82f6" />
            </View>
            <Text className="ml-4 flex-1 text-base font-semibold text-foreground">Invite Friends</Text>
            <ChevronRight size={18} color={theme.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            className="flex-row items-center p-4 rounded-2xl bg-card border border-border/40">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Bell size={18} color="#f59e0b" />
            </View>
            <Text className="ml-4 flex-1 text-base font-semibold text-foreground">Notifications</Text>
            <ChevronRight size={18} color={theme.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
            className="flex-row items-center p-4 rounded-2xl bg-card border border-border/40">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <Settings size={18} color={theme.mutedForeground} />
            </View>
            <Text className="ml-4 flex-1 text-base font-semibold text-foreground">Settings</Text>
            <ChevronRight size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View className="px-5 mt-6 mb-32">
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.8}
            className="flex-row items-center justify-center rounded-2xl bg-destructive/10 py-4">
            <LogOut size={18} color={theme.destructive} />
            <Text className="ml-3 text-base font-bold text-destructive">Sign Out</Text>
          </TouchableOpacity>
          
          <Text className="text-center text-xs text-muted-foreground mt-6">
            Tap In v2.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
