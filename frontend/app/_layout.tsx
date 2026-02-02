import 'react-native-gesture-handler';
import '@/global.css';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { NotificationProvider, useNotifications } from '@/context/NotificationContext';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, AppState, Platform, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { ErrorBoundary } from './error-boundary';
import { useLocation } from '@/hooks/useLocation';
import { useColorScheme } from 'nativewind';
import { supabase } from '@/lib/supabase';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: 'always',
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

function RootLayoutContent() {
  const { session, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { setColorScheme } = useColorScheme();
  const focusManagerSetup = useRef(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const isMounted = useRef(false);

  const { requestPermissions } = useNotifications();

  useEffect(() => {
    if (!loading) {
      // Add a small delay before hiding splash screen to ensure the first route is rendered
      // and we avoid the "black screen" flash during the first transition
      const timer = setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Safety: Force hide splash screen after 15 seconds no matter what
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setLoadingTime(0);
    }
    return () => clearInterval(interval);
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

  useEffect(() => {
    if (user?.id && !loading) {
      requestPermissions().catch((err) => console.error('Push permission error:', err));
    }
  }, [user?.id, loading]);

  useEffect(() => {
    try {
      if (typeof setColorScheme === 'function') {
        setColorScheme('dark');
      }
    } catch (e) {
      console.warn('Failed to set color scheme:', e);
    }
  }, [setColorScheme]);

  useEffect(() => {
    if (focusManagerSetup.current) return;
    focusManagerSetup.current = true;

    try {
      if (Platform.OS !== 'web' && focusManager && typeof focusManager.setEventListener === 'function') {
        focusManager.setEventListener((handleFocus) => {
          if (typeof handleFocus !== 'function') return () => {};
          const subscription = AppState.addEventListener('change', (state) => {
            handleFocus(state === 'active');
          });
          return () => {
            try {
              if (subscription && typeof subscription.remove === 'function') {
                subscription.remove();
              }
            } catch {}
          };
        });
      }
    } catch (err) {
      console.error('Focus manager setup error:', err);
    }
  }, []);

  useLocation(user?.id);

  useEffect(() => {
    if (loading || !isMounted.current) return;

    try {
      const inAuthGroup = segments[0] === '(auth)';
      
      if (!session) {
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
      } else {
        if (!session.user.email_confirmed_at) {
          const inVerifyPage = segments[1] === 'verify';
          if (!inVerifyPage) {
            router.replace('/(auth)/verify');
          }
          return;
        }

        if (inAuthGroup && segments[1] !== 'verify') {
          router.replace('/(tabs)/home');
        }
      }
    } catch (err) {
      console.error('Navigation error in root layout:', err);
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1b4b', // Use the dark blue from the splash screen instead of almost black
          padding: 24,
        }}>
        <StatusBar style="light" />
        <View style={{ marginBottom: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={{ color: '#ffffff', marginTop: 24, fontSize: 18, fontWeight: '600', opacity: 0.9 }}>
            Initializing TapIn...
          </Text>
        </View>

        {loadingTime > 5 && (
          <View style={{ marginTop: 20, alignItems: 'center', width: '100%' }}>
            <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 24, fontSize: 14 }}>
              Connecting to secure servers...
            </Text>
            
            {loadingTime > 10 && (
              <TouchableOpacity
                onPress={handleManualReset}
                activeOpacity={0.7}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  width: '100%',
                }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
                  Force Reset & Update App
                </Text>
              </TouchableOpacity>
            )}

            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 48, textAlign: 'center', lineHeight: 18 }}>
              Build: {Constants.expoConfig?.ios?.buildNumber || '220'} | v{Constants.expoConfig?.version} | {loadingTime}s{'\n'}
              System: {Platform.OS} | {Updates.releaseChannel || 'production'}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat/[id]"
          options={{ headerShown: true, presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#1e1b4b' }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <ChatProvider>
                <RootLayoutContent />
              </ChatProvider>
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
