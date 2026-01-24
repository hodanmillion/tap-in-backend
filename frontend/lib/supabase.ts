import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pcthejcpujqtnurpdmxs.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdGhlamNwdWpxdG51cnBkbXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MDE2NDYsImV4cCI6MjA4MTk3NzY0Nn0.t-M6nEh5fL9dfy3pDbLJ0eyPK9Ad1O4FdLNbVVsMNRc';

const isServer = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: true,
  },
});
