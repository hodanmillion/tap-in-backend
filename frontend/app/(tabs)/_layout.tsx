import { Tabs, useRouter } from 'expo-router';
import { Compass, User, Heart, MessageSquare, Settings, Zap } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { NAV_THEME, THEME } from '@/lib/theme';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const navTheme = NAV_THEME[colorScheme ?? 'light'];
  const router = useRouter();

  const headerRight = () => (
    <View className="flex-row items-center mr-5">
      <View className="mr-3 bg-primary/15 px-3 py-1.5 rounded-xl border border-primary/20">
        <Text className="text-[10px] font-black text-primary uppercase tracking-wider">Pro</Text>
      </View>
      <TouchableOpacity 
        onPress={() => router.push('/settings')}
        activeOpacity={0.7}
        className="h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 border border-border/50"
      >
        <Settings size={20} color={theme.mutedForeground} />
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
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 17,
          letterSpacing: 0.3,
          color: theme.foreground,
        },
        headerRight: headerRight,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 4,
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colorScheme === 'dark' ? 'rgba(12, 12, 16, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 68,
          paddingTop: 6,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={90}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : null
        ),
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Nearby',
          tabBarLabel: 'Nearby',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2.5 rounded-2xl ${focused ? 'bg-primary/15' : ''}`}>
              <Zap color={color} size={22} strokeWidth={focused ? 2.5 : 2} fill={focused ? color : 'transparent'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2.5 rounded-2xl ${focused ? 'bg-primary/15' : ''}`}>
              <Compass color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2.5 rounded-2xl ${focused ? 'bg-primary/15' : ''}`}>
              <Heart color={color} size={22} strokeWidth={focused ? 2.5 : 2} fill={focused ? color : 'transparent'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2.5 rounded-2xl ${focused ? 'bg-primary/15' : ''}`}>
              <MessageSquare color={color} size={22} strokeWidth={focused ? 2.5 : 2} fill={focused ? color : 'transparent'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-2.5 rounded-2xl ${focused ? 'bg-primary/15' : ''}`}>
              <User color={color} size={22} strokeWidth={focused ? 2.5 : 2} fill={focused ? color : 'transparent'} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
