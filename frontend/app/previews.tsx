import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, MessageCircle, Users, Compass, Bell, ArrowRight, User, Plus } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';

const { width, height } = Dimensions.get('window');

// Mock Data for Previews
const MOCK_ROOMS = [
  { id: '1', name: 'Downtown Vibes 🏙️', users: 24, time: '2h 15m left' },
  { id: '2', name: 'Coffee & Code ☕', users: 12, time: '45m left' },
  { id: '3', name: 'Local Meetup 🤝', users: 8, time: '5h left' },
];

const MOCK_MESSAGES = [
  { id: '1', sender: 'Alex', text: 'Anyone near the square?', time: '2m' },
  { id: '2', sender: 'Jordan', text: 'Yeah, heading there now!', time: '1m' },
  { id: '3', sender: 'Sarah', text: 'See you guys in 5!', time: 'Now' },
];

const DeviceFrame = ({ children, colorScheme, theme }: { children: React.ReactNode, colorScheme: string, theme: any }) => (
  <View className="mx-auto h-[600px] w-[300px] overflow-hidden rounded-[40px] border-[8px] border-zinc-800 bg-background shadow-2xl">
    {/* Notch */}
    <View className="absolute top-0 z-50 h-6 w-32 self-center rounded-b-2xl bg-zinc-800" />
    <View className="flex-1 pt-6">
      {children}
    </View>
  </View>
);

const PreviewSlide = ({ title, subtitle, children, theme, colorScheme }: any) => (
  <View style={{ width }} className="flex-1 items-center justify-center px-8">
    <View className="mb-10 items-center">
      <Text className="text-center text-4xl font-black tracking-tight text-white mb-2">
        {title}
      </Text>
      <Text className="text-center text-xl font-medium text-white/80 px-4">
        {subtitle}
      </Text>
    </View>
    <DeviceFrame colorScheme={colorScheme} theme={theme}>
      {children}
    </DeviceFrame>
  </View>
);

export default function PreviewsScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View className="flex-1 bg-primary">
      <SafeAreaView className="flex-1">
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            setActiveTab(Math.round(x / width));
          }}
          scrollEventThrottle={16}
        >
          {/* Slide 1: Discovery */}
          <PreviewSlide
            title="Discover Nearby"
            subtitle="Find active chat zones in your local community."
            theme={theme}
            colorScheme={colorScheme}
          >
            <View className="flex-1 px-4">
              <View className="mb-6 mt-4 flex-row items-center justify-between">
                <Text className="text-2xl font-black text-foreground">Nearby</Text>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
                  <Plus size={20} color="white" />
                </View>
              </View>
              <View className="mb-6 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4">
                <Compass size={20} color="white" />
                <Text className="font-bold text-white">Drop a Pin & Chat</Text>
              </View>
              {MOCK_ROOMS.map(room => (
                <View key={room.id} className="mb-3 flex-row items-center rounded-2xl bg-secondary/50 p-4 border border-border">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Users size={20} color={theme.primary} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-bold text-foreground">{room.name}</Text>
                    <Text className="text-xs text-muted-foreground">{room.time}</Text>
                  </View>
                  <ArrowRight size={16} color={theme.mutedForeground} />
                </View>
              ))}
            </View>
          </PreviewSlide>

          {/* Slide 2: Chat */}
          <PreviewSlide
            title="Instant Chat"
            subtitle="Jump into real-time conversations instantly."
            theme={theme}
            colorScheme={colorScheme}
          >
            <View className="flex-1">
              <View className="border-b border-border p-4 flex-row items-center">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 mr-3">
                  <Users size={16} color={theme.primary} />
                </View>
                <Text className="font-bold text-foreground">Downtown Vibes</Text>
              </View>
              <ScrollView className="flex-1 p-4">
                {MOCK_MESSAGES.map(msg => (
                  <View key={msg.id} className={`mb-4 max-w-[80%] ${msg.sender === 'Alex' ? 'self-start' : 'self-end'}`}>
                    <Text className="mb-1 text-[10px] font-bold text-muted-foreground">{msg.sender}</Text>
                    <View className={`rounded-2xl px-4 py-2 ${msg.sender === 'Alex' ? 'bg-secondary' : 'bg-primary'}`}>
                      <Text className={msg.sender === 'Alex' ? 'text-foreground' : 'text-white'}>{msg.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View className="border-t border-border p-4">
                <View className="h-10 rounded-full bg-secondary px-4 justify-center">
                  <Text className="text-muted-foreground">Type a message...</Text>
                </View>
              </View>
            </View>
          </PreviewSlide>

          {/* Slide 3: Connect */}
          <PreviewSlide
            title="Grow Your Circle"
            subtitle="Connect with people who share your interests."
            theme={theme}
            colorScheme={colorScheme}
          >
            <View className="flex-1 px-4">
              <Text className="mt-4 mb-4 text-2xl font-black text-foreground">People</Text>
              {[
                { name: 'Sarah Miller', dist: '200m away' },
                { name: 'Mike Chen', dist: '500m away' },
                { name: 'Emma Wilson', dist: '1.2km away' }
              ].map((user, i) => (
                <View key={i} className="mb-3 flex-row items-center rounded-2xl bg-card p-4 border border-border">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <User size={24} color={theme.primary} />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="font-bold text-foreground">{user.name}</Text>
                    <Text className="text-xs text-muted-foreground">{user.dist}</Text>
                  </View>
                  <TouchableOpacity className="rounded-full bg-primary px-4 py-1.5">
                    <Text className="text-xs font-bold text-white">Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </PreviewSlide>

          {/* Slide 4: Notifications */}
          <PreviewSlide
            title="Never Miss Out"
            subtitle="Get notified when the action is happening."
            theme={theme}
            colorScheme={colorScheme}
          >
            <View className="flex-1 px-4">
              <Text className="mt-4 mb-4 text-2xl font-black text-foreground">Activity</Text>
              {[
                { text: 'New chat started nearby!', icon: MapPin },
                { text: 'Sarah sent you a message', icon: MessageCircle },
                { text: 'Your zone is trending!', icon: Bell }
              ].map((item, i) => (
                <View key={i} className="mb-3 flex-row items-center rounded-2xl bg-card p-4 border border-border">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/5 mr-3">
                    <item.icon size={20} color={theme.primary} />
                  </View>
                  <Text className="flex-1 text-sm font-medium text-foreground">{item.text}</Text>
                </View>
              ))}
            </View>
          </PreviewSlide>

          {/* Slide 5: Create */}
          <PreviewSlide
            title="Claim Your Zone"
            subtitle="Create a chat room right where you stand."
            theme={theme}
            colorScheme={colorScheme}
          >
            <View className="flex-1 items-center justify-center px-6">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-primary shadow-xl shadow-primary/40 mb-8">
                <MapPin size={48} color="white" />
              </View>
              <Text className="text-2xl font-black text-foreground text-center mb-2">Drop a Pin</Text>
              <Text className="text-center text-muted-foreground mb-8">
                Start a conversation at your current location and let others join the vibe.
              </Text>
              <View className="w-full rounded-2xl bg-secondary p-4 flex-row items-center">
                <Compass size={20} color={theme.primary} />
                <Text className="ml-3 font-bold text-foreground">Nearby Chat (40.712, -74.006)</Text>
              </View>
            </View>
          </PreviewSlide>
        </ScrollView>

        {/* Indicators */}
        <View className="flex-row justify-center gap-2 py-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${activeTab === i ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
            />
          ))}
        </View>

        <TouchableOpacity 
          onPress={() => {}} // Placeholder for "Capture" if we had a script
          className="mx-10 mb-6 items-center justify-center rounded-2xl bg-white py-4 shadow-lg"
        >
          <Text className="text-lg font-black text-primary">Capture These Previews</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
