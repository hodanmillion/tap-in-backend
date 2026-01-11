import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
  Edit2
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
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    occupation: '',
    location_name: '',
    website: '',
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      
      // Initialize form data when profile is loaded
      setFormData({
        full_name: data.full_name || '',
        username: data.username || '',
        bio: data.bio || '',
        occupation: data.occupation || '',
        location_name: data.location_name || '',
        website: data.website || '',
      });
      
      return data;
    },
    enabled: !!user?.id,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/profiles/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
    else router.replace('/(auth)/login');
  }

  const menuGroups = [
    {
      title: 'Social',
      items: [
        { icon: <Heart size={20} color={theme.primary} />, label: 'Friends', route: '/friends' },
        { icon: <Share2 size={20} color={theme.primary} />, label: 'Invite Friends' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: <Bell size={20} color={theme.mutedForeground} />, label: 'Notifications', route: '/notifications' },
        { icon: <Shield size={20} color={theme.mutedForeground} />, label: 'Privacy & Security' },
        { icon: <Settings size={20} color={theme.mutedForeground} />, label: 'Account Settings' },
      ],
    },
  ];

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate(formData);
  };

  if (authLoading || (user?.id && profileLoading)) {
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
                <Info size={20} color={theme.primary} />
                <Text className="ml-3 text-lg font-black text-foreground uppercase tracking-widest">About Me</Text>
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
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mr-4">
                    <Users size={24} color={theme.primary} />
                  </View>
                  <View>
                    <Text className="text-xl font-black text-foreground">142</Text>
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Friends</Text>
                  </View>
                </View>
                <View className="h-12 w-[1px] bg-border" />
                <View className="flex-row items-center">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mr-4">
                    <MessageSquare size={24} color={theme.primary} />
                  </View>
                  <View>
                    <Text className="text-xl font-black text-foreground">856</Text>
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Messages</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      case 'Activity':
        return (
          <View className="px-6 items-center justify-center py-20">
            <View className="h-20 w-20 items-center justify-center rounded-[30px] bg-secondary/50 mb-6">
              <Compass size={32} color={theme.mutedForeground} opacity={0.3} />
            </View>
            <Text className="text-xl font-black text-foreground uppercase tracking-widest">No Activity Yet</Text>
            <Text className="mt-2 text-center text-muted-foreground px-10">
              When you join chats or make friends, your activity will show up here.
            </Text>
          </View>
        );
      case 'Photos':
        return (
          <View className="px-6 items-center justify-center py-20">
            <View className="h-20 w-20 items-center justify-center rounded-[30px] bg-secondary/50 mb-6">
              <ImageIcon size={32} color={theme.mutedForeground} opacity={0.3} />
            </View>
            <Text className="text-xl font-black text-foreground uppercase tracking-widest">No Photos Yet</Text>
            <Text className="mt-2 text-center text-muted-foreground px-10">
              Upload photos to show off your experiences and style!
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="items-center px-6 pt-12 pb-6">
          <View className="relative shadow-2xl shadow-primary/20">
            <View className="h-36 w-36 items-center justify-center rounded-[40px] bg-card border-4 border-background overflow-hidden">
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-full w-full" />
              ) : (
                <User size={64} color={theme.mutedForeground} opacity={0.3} />
              )}
            </View>
            <TouchableOpacity 
              onPress={() => setIsEditModalVisible(true)}
              className="absolute -bottom-2 -right-2 h-12 w-12 items-center justify-center rounded-[18px] bg-primary border-4 border-background shadow-lg"
            >
              <Edit2 size={20} color={theme.primaryForeground} />
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
            onPress={() => setIsEditModalVisible(true)}
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
                    onPress={() => item.route && router.push(item.route as any)}
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

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background rounded-t-[40px] p-8 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-8">
              <Text className="text-3xl font-black text-foreground">Edit Profile</Text>
              <TouchableOpacity 
                onPress={() => setIsEditModalVisible(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
              >
                <ChevronRight size={24} color={theme.foreground} style={{ transform: [{ rotate: '90deg' }] }} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="space-y-6">
                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Full Name</Text>
                  <TextInput
                    className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.full_name}
                    onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.mutedForeground}
                  />
                </View>

                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Username</Text>
                  <TextInput
                    className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.username}
                    onChangeText={(text) => setFormData({ ...formData, username: text })}
                    placeholder="Enter username"
                    placeholderTextColor={theme.mutedForeground}
                    autoCapitalize="none"
                  />
                </View>

                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Bio</Text>
                  <TextInput
                    className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-medium text-base h-32"
                    value={formData.bio}
                    onChangeText={(text) => setFormData({ ...formData, bio: text })}
                    placeholder="Tell the world about yourself..."
                    placeholderTextColor={theme.mutedForeground}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Occupation</Text>
                  <TextInput
                    className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.occupation}
                    onChangeText={(text) => setFormData({ ...formData, occupation: text })}
                    placeholder="What do you do?"
                    placeholderTextColor={theme.mutedForeground}
                  />
                </View>

                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Location</Text>
                  <TextInput
                    className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.location_name}
                    onChangeText={(text) => setFormData({ ...formData, location_name: text })}
                    placeholder="e.g. London, UK"
                    placeholderTextColor={theme.mutedForeground}
                  />
                </View>

                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Website</Text>
                  <TextInput
                    className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.website}
                    onChangeText={(text) => setFormData({ ...formData, website: text })}
                    placeholder="https://..."
                    placeholderTextColor={theme.mutedForeground}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleUpdateProfile}
                disabled={updateProfileMutation.isPending}
                className="mt-10 bg-primary py-6 rounded-[32px] items-center shadow-xl shadow-primary/30"
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text className="text-lg font-black text-primary-foreground uppercase tracking-widest">Save Changes</Text>
                )}
              </TouchableOpacity>
              
              <View className="h-10" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
