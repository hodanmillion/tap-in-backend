import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Share,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '@/lib/api';

const decodeBase64 = (base64: string) => {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error('Base64 decode error:', e);
    throw new Error('Failed to process image data');
  }
};

import { 
  User, 
  LogOut, 
  Settings, 
  Bell, 
  Shield, 
  CircleHelp, 
  Users, 
  ChevronRight, 
  Share2, 
  Compass, 
  Heart,
  Briefcase,
  MapPin,
  Globe,
  Info,
  Camera,
  MessageSquare,
  Image as ImageIcon,
  Edit2,
  Clock,
  Map as MapIcon
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

type Tab = 'About' | 'Activity' | 'Photos';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('About');
  const [uploading, setUploading] = useState(false);

    const { data: profile, isLoading: profileIsLoading, refetch: refetchProfile } = useQuery({
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
      staleTime: 60000,
      gcTime: 1000 * 60 * 30,
    });

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

  const { data: userPhotos, isLoading: photosLoading } = useQuery({
    queryKey: ['profile-photos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.storage
        .from('avatars')
        .list(user.id, {
          limit: 10,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' },
        });
      if (error) throw error;
      
      return data.map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${user.id}/${file.name}`);
        return publicUrl;
      });
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
        queryClient.invalidateQueries({ queryKey: ['profile-photos', user?.id] });
        refetchProfile();
        Alert.alert('Success', 'Profile updated successfully!');
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
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        uploadAvatar(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (base64: string) => {
    if (!user?.id) return;
    
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, decodeBase64(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfileMutation.mutateAsync({ avatar_url: publicUrl });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
    else router.replace('/(auth)/login');
  }

  const handleInvite = async () => {
    try {
      const result = await Share.share({
        message: `Check out Tap In! Connect with people and discover what's happening right where you are. Download it now: https://tapin.app`,
        title: 'Join Tap In',
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const menuGroups: {
    title: string;
    items: {
      icon: JSX.Element;
      label: string;
      route?: string;
      onPress?: () => void;
    }[];
  }[] = [
    {
      title: 'Social',
      items: [
        { icon: <Heart size={20} color={theme.primary} />, label: 'Friends', route: '/friends' },
        { icon: <Share2 size={20} color={theme.primary} />, label: 'Invite Friends', onPress: handleInvite },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: <Bell size={20} color={theme.mutedForeground} />, label: 'Notifications', route: '/notifications' },
        { icon: <Shield size={20} color={theme.mutedForeground} />, label: 'Privacy & Security', route: '/settings' },
        { icon: <Settings size={20} color={theme.mutedForeground} />, label: 'Account Settings', route: '/settings' },
      ],
    },
  ];

  const handleUpdateProfile = () => {
    router.push('/edit-profile');
  };

  if (authLoading || (user?.id && profileIsLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'About':
        return (
          <View className="px-6 space-y-6">
            <View className="rounded-[32px] bg-card border border-border p-6 shadow-sm">
              <View className="flex-row items-center mb-4">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/20 mr-3">
                  <Info size={20} color="hsl(var(--brand-purple))" />
                </View>
                <Text className="text-lg font-black text-foreground uppercase tracking-widest">About Me</Text>
              </View>
              <Text className="text-base text-muted-foreground leading-6">
                {profile?.bio || "No bio yet. Tap 'Edit Profile' to add one!"}
              </Text>
              
              <View className="mt-8 space-y-4">
                {profile?.occupation && (
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 mr-4">
                      <Briefcase size={18} color={theme.mutedForeground} />
                    </View>
                    <View>
                      <Text className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Occupation</Text>
                      <Text className="text-base font-bold text-foreground">{profile.occupation}</Text>
                    </View>
                  </View>
                )}
                
                {profile?.location_name && (
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 mr-4">
                      <MapPin size={18} color={theme.mutedForeground} />
                    </View>
                    <View>
                      <Text className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Location</Text>
                      <Text className="text-base font-bold text-foreground">{profile.location_name}</Text>
                    </View>
                  </View>
                )}
                
                {profile?.website && (
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 mr-4">
                      <Globe size={18} color={theme.mutedForeground} />
                    </View>
                    <View>
                      <Text className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Website</Text>
                      <Text className="text-base font-bold text-primary">{profile.website}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View className="rounded-[32px] bg-card border border-border p-6 shadow-sm mb-6">
              <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-pink/10 mr-4">
                      <Users size={24} color="hsl(var(--brand-pink))" />
                    </View>
                      <View>
                        <Text className="text-xl font-black text-foreground">{friendCount}</Text>
                        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Friends</Text>
                      </View>
                    </View>
                    <View className="h-12 w-[1px] bg-border mx-2" />
                    <View className="flex-row items-center">
                      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-cyan/10 mr-4">
                        <MessageSquare size={24} color="hsl(var(--brand-cyan))" />
                      </View>
                      <View>
                        <Text className="text-xl font-black text-foreground">{messageCount}</Text>
                        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Messages</Text>
                      </View>

                </View>
              </View>
            </View>
          </View>
        );
      case 'Activity':
        if (activityLoading) {
          return (
            <View className="px-6 py-20 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          );
        }
        return (
          <View className="px-6 space-y-4">
            {activity && activity.length > 0 ? (
              activity.map((item: any, index: number) => (
                <View key={index} className="flex-row items-center bg-card border border-border p-4 rounded-3xl">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mr-4">
                    <MessageSquare size={24} color={theme.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground">
                      Joined {item.chat_rooms?.name || 'a chat room'}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Clock size={12} color={theme.mutedForeground} />
                      <Text className="ml-1 text-xs text-muted-foreground">
                        {new Date(item.joined_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={theme.mutedForeground} opacity={0.3} />
                </View>
              ))
            ) : (
              <View className="items-center justify-center py-20">
                <View className="h-20 w-20 items-center justify-center rounded-[30px] bg-secondary/50 mb-6">
                  <Compass size={32} color={theme.mutedForeground} opacity={0.3} />
                </View>
                <Text className="text-xl font-black text-foreground uppercase tracking-widest">No Activity Yet</Text>
                <Text className="mt-2 text-center text-muted-foreground px-10">
                  When you join chats or make friends, your activity will show up here.
                </Text>
              </View>
            )}
            <View className="h-10" />
          </View>
        );
      case 'Photos':
        if (photosLoading) {
          return (
            <View className="px-6 py-20 items-center">
              <ActivityIndicator color={theme.primary} />
            </View>
          );
        }
        return (
          <View className="px-6">
            <TouchableOpacity 
              onPress={pickImage}
              className="mb-6 flex-row items-center justify-center bg-primary/10 border-2 border-dashed border-primary/30 p-8 rounded-[32px]"
            >
              <Camera size={24} color={theme.primary} />
              <Text className="ml-3 text-base font-black text-primary uppercase tracking-widest">Add New Photo</Text>
            </TouchableOpacity>

            {userPhotos && userPhotos.length > 0 ? (
              <View className="flex-row flex-wrap -mx-2">
                {userPhotos.map((url: string, index: number) => (
                  <View key={index} className="w-1/2 p-2">
                    <View className="aspect-square rounded-[24px] overflow-hidden bg-card border border-border shadow-sm">
                      <Image source={{ uri: url }} className="h-full w-full" />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center justify-center py-10">
                <View className="h-20 w-20 items-center justify-center rounded-[30px] bg-secondary/50 mb-6">
                  <ImageIcon size={32} color={theme.mutedForeground} opacity={0.3} />
                </View>
                <Text className="text-xl font-black text-foreground uppercase tracking-widest">No Photos Yet</Text>
                <Text className="mt-2 text-center text-muted-foreground px-10">
                  Upload photos to show off your experiences and style!
                </Text>
              </View>
            )}
            <View className="h-10" />
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="items-center px-6 pt-12 pb-6">
          <View className="relative shadow-2xl shadow-primary/20">
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              className="h-36 w-36 items-center justify-center rounded-[40px] bg-card border-4 border-background overflow-hidden"
            >
              {uploading ? (
                <ActivityIndicator color={theme.primary} />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-full w-full" />
              ) : (
                <User size={64} color={theme.mutedForeground} opacity={0.3} />
              )}
              <View className="absolute inset-0 bg-black/20 items-center justify-center opacity-0 hover:opacity-100">
                <Camera size={24} color="white" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 h-12 w-12 items-center justify-center rounded-[18px] bg-primary border-4 border-background shadow-lg"
            >
              <Camera size={20} color={theme.primaryForeground} />
            </TouchableOpacity>
          </View>
          
          <Text className="mt-8 text-3xl font-black tracking-tight text-foreground text-center">
            {profile?.full_name || 'Anonymous User'}
          </Text>
          <View className="mt-2 flex-row items-center bg-secondary px-4 py-1.5 rounded-full">
            <Text className="text-sm font-bold text-secondary-foreground uppercase tracking-widest">
              @{profile?.username || 'tapin_user'}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={handleUpdateProfile}
            className="mt-6 bg-primary/10 px-6 py-3 rounded-2xl border border-primary/20"
          >
            <Text className="text-sm font-black text-primary uppercase tracking-widest">Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="flex-row px-6 mb-8 mt-4">
          {(['About', 'Activity', 'Photos'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`mr-4 px-6 py-3 rounded-2xl ${
                activeTab === tab ? 'bg-primary' : 'bg-secondary/50'
              }`}
            >
              <Text
                className={`text-sm font-black uppercase tracking-widest ${
                  activeTab === tab ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderTabContent()}

        <View className="px-6 mt-8">
          {menuGroups.map((group, groupIdx) => (
            <View key={groupIdx} className="mb-8">
              <Text className="mb-4 ml-2 text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/40">
                {group.title}
              </Text>
              <View className="overflow-hidden rounded-[32px] bg-card border border-border shadow-sm">
                {group.items.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        if (item.onPress) item.onPress();
                        else if (item.route) router.push(item.route as any);
                      }}
                      activeOpacity={0.6}
                      className={`flex-row items-center p-6 active:bg-secondary/50 ${
                        index !== group.items.length - 1 ? 'border-b border-border' : ''
                      }`}>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-secondary/50">
                      {item.icon}
                    </View>
                    <Text className="ml-4 flex-1 text-lg font-bold text-foreground">{item.label}</Text>
                    <ChevronRight size={18} color={theme.mutedForeground} opacity={0.3} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View className="px-6 mt-4 mb-16">
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.8}
            className="flex-row items-center justify-center rounded-[32px] bg-destructive/5 py-6 border border-destructive/10 active:bg-destructive/10">
            <LogOut size={22} color={theme.destructive} />
            <Text className="ml-3 text-lg font-black text-destructive uppercase tracking-[0.15em]">Sign Out</Text>
          </TouchableOpacity>
          
          <View className="mt-12 items-center">
             <View className="h-1.5 w-1.5 rounded-full bg-border mb-4" />
             <Text className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.4em]">
               Tap In Version 2.0.0
             </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
