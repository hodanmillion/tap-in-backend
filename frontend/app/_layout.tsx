import '@/global.css';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, AppState, Platform } from 'react-native';
import { ErrorBoundary } from './error-boundary';
import { useLocation } from '@/hooks/useLocation';
import { useNotifications } from '@/hooks/useNotifications';
import { useColorScheme } from 'nativewind';

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

  const { requestPermissions } = useNotifications();

  useEffect(() => {
    if (user?.id && !loading) {
      requestPermissions();
    }
  }, [user?.id, loading]);

  useEffect(() => {
    setColorScheme('dark');
  }, []);

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
              subscription.remove();
            } catch {}
          };
        });
      }
    } catch {}
  }, []);

  useLocation(user?.id);



  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
        }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chat/[id]"
        options={{ headerShown: true, presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen name="friends" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ChatProvider>
            <RootLayoutContent />
          </ChatProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
