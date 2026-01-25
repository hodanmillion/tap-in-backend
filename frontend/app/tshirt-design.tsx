import React from 'react';
import { View, Text, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function TshirtDesignScreen() {
  const router = useRouter();

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out the TapIn T-Shirt Design!',
        url: 'https://tapin.social/tshirt-design', // Placeholder
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
          >
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-white">T-Shirt Design</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 items-center justify-center px-8">
          {/* The Design Container */}
          <View className="items-center justify-center">
            
            {/* App Icon Style Component */}
            <View className="relative items-center justify-center">
              {/* Outer Glow */}
              <View 
                className="absolute h-64 w-64 rounded-[60px] bg-purple-600/20 blur-3xl"
                style={{ shadowColor: '#9333ea', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 40 }}
              />
              
              {/* Main Icon Square */}
              <View className="h-48 w-48 items-center justify-center overflow-hidden rounded-[48px] bg-zinc-900 border border-white/5 shadow-2xl">
                <View className="items-center justify-center">
                  <Zap size={80} color="white" fill="white" />
                  
                  {/* PRO Badge */}
                  <View className="mt-4 rounded-full bg-zinc-800 px-5 py-1.5 border border-white/10">
                    <Text className="text-xs font-black tracking-[2px] text-white">PRO</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* TapIn Text */}
            <Text className="mt-12 text-6xl font-black tracking-tighter text-white">
              TapIn
            </Text>

            {/* Subtext */}
            <Text className="mt-4 text-center text-xl font-medium text-zinc-400">
              Welcome back. Your{"\n"}connections are waiting.
            </Text>
          </View>
        </View>

        {/* Footer Actions */}
        <View className="px-8 pb-10">
          <Text className="mb-6 text-center text-xs font-medium text-zinc-500 uppercase tracking-widest">
            Ready for high-quality print
          </Text>
          
          <TouchableOpacity 
            onPress={handleShare}
            className="mb-4 w-full items-center justify-center rounded-2xl bg-white py-4"
          >
            <Text className="text-lg font-black text-black">Share Design</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-full items-center justify-center rounded-2xl bg-zinc-900 py-4 border border-white/10"
          >
            <Text className="text-lg font-bold text-white">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
