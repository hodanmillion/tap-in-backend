import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check your environment variables.');
}

// Custom storage wrapper to prevent "window is not defined" error during SSR/Static rendering
const customStorage = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') {
      if (Platform.OS === 'web') return null;
      return AsyncStorage.getItem(key);
    }
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') {
      if (Platform.OS === 'web') return;
      await AsyncStorage.setItem(key, value);
      return;
    }
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') {
      if (Platform.OS === 'web') return;
      await AsyncStorage.removeItem(key);
      return;
    }
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

// Ensure URL is valid before creating client to prevent immediate crash
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
