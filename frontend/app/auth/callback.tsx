import { useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator, Alert, Text } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    code?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  }>();
  
  const processing = useRef(false);

  useEffect(() => {
    async function handleCallback() {
      if (processing.current) return;
      processing.current = true;

      const { code, access_token, refresh_token, error, error_description } = params;

      if (error) {
        console.error('Auth Error:', error, error_description);
        Alert.alert('Authentication Error', error_description || error);
        router.replace('/(auth)/login');
        return;
      }

      try {
        if (code) {
          // PKCE Flow
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          router.replace('/(tabs)/home');
        } else if (access_token && refresh_token) {
          // Implicit Flow (often from email links)
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) throw sessionError;
          router.replace('/(tabs)/home');
        } else {
          // No tokens found, check if we already have a session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            router.replace('/(tabs)/home');
          } else {
            console.log('No session or tokens found in callback');
            router.replace('/(auth)/login');
          }
        }
      } catch (err: any) {
        console.error('Callback handling error:', err.message);
        Alert.alert('Verification Failed', err.message);
        router.replace('/(auth)/login');
      } finally {
        processing.current = false;
      }
    }

    handleCallback();
  }, [params, router]);

  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <View className="items-center">
        <ActivityIndicator size="large" color="#000" />
        <Text className="mt-4 text-foreground font-bold text-lg">Finalizing Verification...</Text>
        <Text className="mt-2 text-muted-foreground text-center">Please wait while we secure your account.</Text>
      </View>
    </View>
  );
}
