import { View, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

export default function Index() {
  const { session, loading } = useAuth();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setShowRetry(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleManualReset = async () => {
    try {
      await AsyncStorage.clear();
      if (Platform.OS !== 'web') {
        await Updates.reloadAsync();
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to reset:', e);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1e1b4b', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={{ color: '#ffffff', marginTop: 24, fontSize: 16, opacity: 0.8 }}>
          Loading TapIn...
        </Text>
        {showRetry && (
          <View style={{ marginTop: 40, alignItems: 'center', width: '100%' }}>
            <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 20 }}>
              Connecting to servers...
            </Text>
            <TouchableOpacity
              onPress={handleManualReset}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
                width: '100%',
              }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>Clear Cache & Restart</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Use declarative Redirect for better reliability in Expo Router
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!session.user.email_confirmed_at) {
    return <Redirect href="/(auth)/verify" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
