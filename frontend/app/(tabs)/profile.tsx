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
import { User, LogOut, Settings, Bell, Shield, CircleHelp, Users, ChevronRight, Share2, Compass, Heart } from 'lucide-react-native';
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
        <View className="items-center px-6 py-12">
          <View className="relative shadow-2xl shadow-primary/20">
            <View className="h-36 w-36 items-center justify-center rounded-[40px] bg-card border-4 border-background overflow-hidden">
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-full w-full" />
              ) : (
                <User size={64} color={theme.mutedForeground} opacity={0.3} />
              )}
            </View>
            <TouchableOpacity className="absolute -bottom-2 -right-2 h-12 w-12 items-center justify-center rounded-[18px] bg-primary border-4 border-background shadow-lg">
              <Settings size={20} color={theme.primaryForeground} />
            </TouchableOpacity>
          </View>
          
          <Text className="mt-8 text-3xl font-black tracking-tight text-foreground">
            {profile?.full_name || 'Anonymous User'}
          </Text>
          <View className="mt-2 flex-row items-center bg-secondary px-4 py-1.5 rounded-full">
            <Text className="text-sm font-bold text-secondary-foreground uppercase tracking-widest">
              @{profile?.username || 'tapin_user'}
            </Text>
          </View>
        </View>

        <View className="px-6">
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
    </SafeAreaView>
  );
}
