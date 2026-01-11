import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Logo } from '@/components/Logo';
import { ChevronRight, Globe, Zap, Users, Shield } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Tap into Connections',
    description: 'Connect with people around you instantly. Discover local communities and events.',
    icon: Globe,
    color: '#3B82F6',
  },
  {
    title: 'Lightning Fast',
    description: 'Experience real-time updates and seamless communication across the platform.',
    icon: Zap,
    color: '#F59E0B',
  },
  {
    title: 'Build Community',
    description: 'Join groups that matter to you. Share experiences and grow together.',
    icon: Users,
    color: '#10B981',
  },
  {
    title: 'Safe & Secure',
    description: 'Your data is protected with enterprise-grade security and privacy controls.',
    icon: Shield,
    color: '#8B5CF6',
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.push('/(auth)/login');
    }
  };

  const Icon = SLIDES[currentSlide].icon;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-8 justify-between py-12">
        <Animated.View 
          entering={FadeInUp.delay(200)}
          className="items-center"
        >
          <Logo size="lg" className="mb-4" />
          <Text className="text-xl font-black text-foreground tracking-widest uppercase">TapIn</Text>
        </Animated.View>

        <View className="items-center">
          <Animated.View 
            key={`icon-${currentSlide}`}
            entering={FadeInDown.duration(600)}
            className="w-24 h-24 rounded-full items-center justify-center mb-10"
            style={{ backgroundColor: `${SLIDES[currentSlide].color}15` }}
          >
            <Icon size={48} color={SLIDES[currentSlide].color} strokeWidth={2.5} />
          </Animated.View>

          <Animated.View 
            key={`text-${currentSlide}`}
            entering={FadeInDown.delay(200).duration(600)}
            className="items-center"
          >
            <Text className="text-4xl font-black text-foreground text-center mb-4 tracking-tight leading-tight">
              {SLIDES[currentSlide].title}
            </Text>
            <Text className="text-lg text-muted-foreground text-center px-4 font-medium leading-relaxed">
              {SLIDES[currentSlide].description}
            </Text>
          </Animated.View>
        </View>

        <View className="items-center w-full">
          <View className="flex-row gap-2 mb-10">
            {SLIDES.map((_, i) => (
              <View 
                key={i}
                className={`h-2 rounded-full ${i === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-muted/30'}`}
              />
            ))}
          </View>

          <TouchableOpacity 
            onPress={nextSlide}
            className="w-full bg-primary h-16 rounded-3xl flex-row items-center justify-center shadow-xl shadow-primary/30"
          >
            <Text className="text-primary-foreground text-lg font-black uppercase tracking-widest">
              {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <ChevronRight size={20} color={theme.primaryForeground} strokeWidth={3} className="ml-2" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(auth)/login')}
            className="mt-6 py-2"
          >
            <Text className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Skip to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
