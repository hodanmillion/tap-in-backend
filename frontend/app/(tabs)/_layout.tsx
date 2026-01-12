import { Tabs, useRouter } from 'expo-router';
import { Home, Compass, User, Heart, MessageSquare, Settings, Zap } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { NAV_THEME, THEME } from '@/lib/theme';
import { View, TouchableOpacity, Text } from 'react-native';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const navTheme = NAV_THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const headerRight = () => (
    <View className="flex-row items-center mr-5">
      <View className="mr-3 bg-primary/20 px-2 py-1 rounded-md border border-primary/30">
        <Text className="text-[10px] font-black text-primary uppercase">Pro</Text>
      </View>
      <TouchableOpacity 
        onPress={() => router.push('/settings')}
        className="h-10 w-10 items-center justify-center rounded-xl bg-secondary/50"
      >
        <Settings size={22} color={theme.foreground} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarShowLabel: true,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: theme.foreground,
        },
        headerRight: headerRight,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 8,
        },
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 90,
          paddingTop: 12,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Tap In Pro',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2 rounded-xl ${focused ? 'bg-primary/10' : ''}`}>
              <Zap color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2 rounded-xl ${focused ? 'bg-primary/10' : ''}`}>
              <Compass color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2 rounded-xl ${focused ? 'bg-primary/10' : ''}`}>
              <Heart color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2 rounded-xl ${focused ? 'bg-primary/10' : ''}`}>
              <MessageSquare color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2 rounded-xl ${focused ? 'bg-primary/10' : ''}`}>
              <User color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
