import { View, Text, Image, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { User, LogOut, Settings, Bell, Shield, CircleHelp, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
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

  const menuItems = [
    { icon: <Users size={20} color="#3b82f6" />, label: 'My Friends', route: '/friends' },
    { icon: <Bell size={20} color="#6b7280" />, label: 'Notifications' },
    { icon: <Shield size={20} color="#6b7280" />, label: 'Privacy & Security' },
    { icon: <CircleHelp size={20} color="#6b7280" />, label: 'Help Center' },
    { icon: <Settings size={20} color="#6b7280" />, label: 'Settings' },
  ];

  if (authLoading || (user?.id && profileLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-6">
        <View className="items-center py-8">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-secondary">
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="h-24 w-24 rounded-full"
              />
            ) : (
              <User size={48} color="#9ca3af" />
            )}
          </View>
          <Text className="mt-4 text-2xl font-bold text-foreground">
            {profile?.full_name || 'Anonymous User'}
          </Text>
          <Text className="text-muted-foreground">@{profile?.username || 'user'}</Text>
        </View>

        <View className="mt-4 rounded-3xl bg-card p-2 shadow-sm">
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => item.route && router.push(item.route as any)}
              className={`flex-row items-center p-4 ${
                index !== menuItems.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {item.icon}
              <Text className="ml-4 flex-1 text-base text-foreground">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSignOut}
          className="mt-8 flex-row items-center justify-center rounded-2xl bg-destructive/10 p-4"
        >
          <LogOut size={20} color="#ef4444" />
          <Text className="ml-2 text-base font-semibold text-destructive">Sign Out</Text>
        </TouchableOpacity>

        <Text className="mt-8 text-center text-xs text-muted-foreground">
          Tap In v1.0.0 • Made with ❤️
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
