import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  ChevronRight, 
  Smartphone, 
  MapPin, 
  MessageSquare, 
  Zap, 
  ShieldCheck,
  Users,
  Compass,
  ArrowRight
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PREVIEWS = [
  {
    id: 'intro',
    title: 'Tap In',
    subtitle: 'The Hyper-Local Social Network',
    description: 'Connect with people exactly where you are.',
    color: ['#3b82f6', '#1d4ed8'],
    icon: <Zap size={48} color="white" />,
    mockup: 'Splash'
  },
  {
    id: 'discovery',
    title: 'Discover Nearby',
    subtitle: 'Real-time Chat Zones',
    description: 'See active conversations within meters of your location.',
    color: ['#8b5cf6', '#6d28d9'],
    icon: <MapPin size={48} color="white" />,
    mockup: 'Home'
  },
  {
    id: 'chat',
    title: 'Chat Instantly',
    subtitle: 'No Strings Attached',
    description: 'Jump into local threads and meet new people around you.',
    color: ['#ec4899', '#be185d'],
    icon: <MessageSquare size={48} color="white" />,
    mockup: 'Chat'
  },
  {
    id: 'privacy',
    title: 'Private & Secure',
    subtitle: 'Your Location, Protected',
    description: 'Choose when and where you want to be seen.',
    color: ['#10b981', '#047857'],
    icon: <ShieldCheck size={48} color="white" />,
    mockup: 'Privacy'
  }
];

const MockHome = () => (
  <View className="flex-1 bg-background p-4">
    <View className="mb-6 flex-row items-center justify-between">
      <View>
        <Text className="text-2xl font-black text-foreground">Nearby</Text>
        <Text className="text-xs font-bold text-muted-foreground uppercase">Live Discovery</Text>
      </View>
      <View className="h-10 w-10 rounded-full bg-primary" />
    </View>
    <View className="mb-4 rounded-3xl bg-primary p-5 shadow-lg">
      <View className="flex-row items-center gap-3">
        <Compass size={24} color="white" />
        <Text className="text-lg font-bold text-white">Drop a Pin & Chat</Text>
      </View>
    </View>
    {[1, 2, 3].map((i) => (
      <View key={i} className="mb-4 flex-row items-center rounded-3xl bg-card p-4 border border-border">
        <View className="h-12 w-12 rounded-2xl bg-secondary" />
        <View className="ml-4 flex-1">
          <Text className="text-base font-bold text-foreground">Nearby Chat #{i}</Text>
          <Text className="text-xs text-muted-foreground">Active for 2h 15m</Text>
        </View>
        <ArrowRight size={18} color="#64748b" />
      </View>
    ))}
  </View>
);

const MockChat = () => (
  <View className="flex-1 bg-background">
    <View className="border-b border-border p-4 flex-row items-center bg-card">
      <ChevronLeft size={24} color="#3b82f6" />
      <Text className="ml-2 text-lg font-bold text-foreground">Central Park Hub</Text>
    </View>
    <ScrollView className="flex-1 p-4">
      <View className="mb-4 items-start">
        <View className="max-w-[80%] rounded-2xl bg-secondary p-3">
          <Text className="text-foreground">Hey! Is anyone here for the concert?</Text>
        </View>
      </View>
      <View className="mb-4 items-end">
        <View className="max-w-[80%] rounded-2xl bg-primary p-3">
          <Text className="text-white">Yeah, I'm by the south gate. It's packed!</Text>
        </View>
      </View>
      <View className="mb-4 items-start">
        <View className="max-w-[80%] rounded-2xl bg-secondary p-3">
          <Text className="text-foreground">Cool! Meeting some friends near the fountain soon.</Text>
        </View>
      </View>
    </ScrollView>
    <View className="border-t border-border p-4 bg-card flex-row items-center">
      <View className="flex-1 rounded-full bg-secondary px-4 py-2">
        <Text className="text-muted-foreground">Type a message...</Text>
      </View>
      <View className="ml-3 h-10 w-10 rounded-full bg-primary items-center justify-center">
        <Zap size={20} color="white" />
      </View>
    </View>
  </View>
);

const DeviceFrame = ({ children, mockup }: { children: React.ReactNode, mockup: string }) => (
  <View className="h-[550px] w-[280px] self-center overflow-hidden rounded-[45px] border-[8px] border-zinc-900 bg-black shadow-2xl">
    <View className="absolute top-0 z-50 h-6 w-32 self-center rounded-b-3xl bg-zinc-900" />
    <View className="flex-1 pt-6">
      {mockup === 'Home' ? <MockHome /> : mockup === 'Chat' ? <MockChat /> : children}
    </View>
    <View className="absolute bottom-1 h-1 w-24 self-center rounded-full bg-zinc-800" />
  </View>
);

export default function PreviewsScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const current = PREVIEWS[currentIndex];

  const next = () => setCurrentIndex((prev) => (prev + 1) % PREVIEWS.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + PREVIEWS.length) % PREVIEWS.length);

  return (
    <View className="flex-1 bg-zinc-950">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6">
          <View className="mt-4 flex-row items-center justify-between">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-zinc-900"
            >
              <ChevronLeft size={24} color="white" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-xs font-black uppercase tracking-widest text-zinc-500">App Store Previews</Text>
              <Text className="text-zinc-400 text-[10px]">{currentIndex + 1} of {PREVIEWS.length}</Text>
            </View>
            <TouchableOpacity 
              onPress={next}
              className="h-10 w-10 items-center justify-center rounded-full bg-zinc-900"
            >
              <ChevronRight size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View className="mt-10 items-center text-center">
            <Text className="text-4xl font-black tracking-tight text-white text-center">
              {current.title}
            </Text>
            <Text className="mt-2 text-xl font-bold text-blue-500 text-center">
              {current.subtitle}
            </Text>
            <Text className="mt-4 px-10 text-center text-zinc-400 leading-relaxed">
              {current.description}
            </Text>
          </View>

          <View className="mt-12 flex-1 justify-center pb-10">
            <DeviceFrame mockup={current.mockup}>
              <View className="flex-1 items-center justify-center bg-zinc-950">
                 <View className="mb-6 h-24 w-24 items-center justify-center rounded-[30px] bg-blue-600 shadow-xl shadow-blue-500/50">
                    <Zap size={48} color="white" strokeWidth={2.5} />
                 </View>
                 <Text className="text-3xl font-black text-white">Tap In</Text>
                 <Text className="mt-2 text-zinc-500 font-bold">BY ORCHIDS</Text>
              </View>
            </DeviceFrame>
          </View>

          <View className="mb-8 flex-row justify-center gap-2">
            {PREVIEWS.map((_, i) => (
              <View 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-8 bg-blue-500' : 'w-2 bg-zinc-800'}`} 
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
