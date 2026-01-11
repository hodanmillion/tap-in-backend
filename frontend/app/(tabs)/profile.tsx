import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { User, LogOut, Settings, Bell, Shield, CircleHelp, Users, ChevronRight, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();

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
      return data;
    },
    enabled: !!user?.id,
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
        { icon: <Users size={20} color={theme.primary} />, label: 'My Friends', route: '/friends' },
        { icon: <Share2 size={20} color={theme.primary} />, label: 'Invite Friends' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { icon: <Bell size={20} color={theme.mutedForeground} />, label: 'Notifications', route: '/notifications' },
        { icon: <Shield size={20} color={theme.mutedForeground} />, label: 'Privacy & Security' },
        { icon: <CircleHelp size={20} color={theme.mutedForeground} />, label: 'Help Center' },
        { icon: <Settings size={20} color={theme.mutedForeground} />, label: 'App Settings' },
      ],
    },
  ];

  if (authLoading || (user?.id && profileLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="items-center px-6 py-10">
          <View className="relative">
            <View className="h-32 w-32 items-center justify-center rounded-full bg-secondary border-4 border-background shadow-sm">
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-[120px] w-[120px] rounded-full" />
              ) : (
                <User size={60} color={theme.mutedForeground} opacity={0.5} />
              )}
            </View>
            <TouchableOpacity className="absolute bottom-1 right-1 h-10 w-10 items-center justify-center rounded-full bg-primary border-4 border-background shadow-lg">
              <Settings size={18} color={theme.primaryForeground} />
            </TouchableOpacity>
          </View>
          
          <Text className="mt-6 text-3xl font-black tracking-tight text-foreground">
            {profile?.full_name || 'Anonymous'}
          </Text>
          <Text className="text-lg font-medium text-muted-foreground">@{profile?.username || 'user'}</Text>
        </View>

        <View className="px-6 space-y-8">
          {menuGroups.map((group, groupIdx) => (
            <View key={groupIdx} className="mb-6">
              <Text className="mb-3 ml-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                {group.title}
              </Text>
              <View className="overflow-hidden rounded-3xl bg-card border border-border shadow-sm">
                {group.items.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => item.route && router.push(item.route as any)}
                    className={`flex-row items-center p-5 active:bg-secondary/50 ${
                      index !== group.items.length - 1 ? 'border-b border-border' : ''
                    }`}>
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-secondary/50">
                      {item.icon}
                    </View>
                    <Text className="ml-4 flex-1 text-base font-bold text-foreground">{item.label}</Text>
                    <ChevronRight size={18} color={theme.mutedForeground} opacity={0.5} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View className="px-6 mt-4 mb-12">
          <TouchableOpacity
            onPress={handleSignOut}
            className="flex-row items-center justify-center rounded-3xl bg-destructive/10 py-5 border border-destructive/20 active:bg-destructive/20">
            <LogOut size={20} color={theme.destructive} />
            <Text className="ml-2 text-base font-black text-destructive uppercase tracking-widest">Sign Out</Text>
          </TouchableOpacity>
          
          <Text className="mt-8 text-center text-xs font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">
            Tap In • v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
