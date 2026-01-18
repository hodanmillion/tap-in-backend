import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Stack } from 'expo-router';
import { getPerformanceTimings, getApiLogs, clearApiLogs } from '../lib/perf';
import { ChevronLeft, Share2, Trash2, RefreshCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function DebugScreen() {
  const router = useRouter();
  const [timings, setTimings] = useState(getPerformanceTimings());
  const [apiLogs, setApiLogs] = useState(getApiLogs());

  const refresh = () => {
    setTimings(getPerformanceTimings());
    setApiLogs(getApiLogs());
  };

  const handleClear = () => {
    clearApiLogs();
    refresh();
  };

  const handleShare = async () => {
    const data = {
      timings,
      apiLogs,
      deviceInfo: {
        platform: 'ios', // Simplification
      }
    };
    await Share.share({
      message: JSON.stringify(data, null, 2),
      title: 'TapIn Debug Data'
    });
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen 
        options={{
          title: "Debug & Performance",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View className="flex-row">
              <TouchableOpacity onPress={handleShare} className="mr-4">
                <Share2 size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClear}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )
        }}
      />

      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xl font-bold">App Timings</Text>
            <TouchableOpacity onPress={refresh}>
              <RefreshCw size={18} color="#666" />
            </TouchableOpacity>
          </View>
          {Object.entries(timings).map(([name, time]) => (
            <View key={name} className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-muted-foreground">{name}</Text>
              <Text className="font-mono font-medium">{time.toFixed(2)}ms</Text>
            </View>
          ))}
        </View>

        <View>
          <Text className="text-xl font-bold mb-2">Last 20 API Calls</Text>
          {apiLogs.length === 0 ? (
            <Text className="text-muted-foreground italic">No logs yet</Text>
          ) : (
            apiLogs.map((log, i) => (
              <View key={i} className="mb-3 p-3 bg-muted rounded-lg">
                <View className="flex-row justify-between mb-1">
                  <Text className="font-bold text-xs uppercase" style={{ color: typeof log.status === 'number' && log.status < 400 ? '#10b981' : '#ef4444' }}>
                    {log.method} {log.status}
                  </Text>
                  <Text className="text-xs font-mono">{log.duration.toFixed(0)}ms</Text>
                </View>
                <Text className="text-xs font-mono mb-1" numberOfLines={1}>{log.url}</Text>
                <Text className="text-[10px] text-muted-foreground italic">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))
          ).reverse()}
        </View>
      </ScrollView>
    </View>
  );
}
