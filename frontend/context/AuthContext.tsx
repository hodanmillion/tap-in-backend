import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Handle deep links for authentication
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);
      const { queryParams } = Linking.parse(url);
      
      // Extract tokens from the URL fragment (hash) or query params
      // Supabase redirects often use hash fragments for tokens
      const fragment = url.split('#')[1];
      const params: Record<string, string> = {};
      
      if (fragment) {
        fragment.split('&').forEach(part => {
          const [key, value] = part.split('=');
          params[key] = value;
        });
      }

      const accessToken = params.access_token || queryParams?.access_token as string;
      const refreshToken = params.refresh_token || queryParams?.refresh_token as string;

      if (accessToken && refreshToken) {
        console.log('Auth tokens found in deep link, setting session...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('Error setting session from deep link:', error.message);
        } else if (data.session) {
          console.log('Session set successfully from deep link');
          setSession(data.session);
          setUser(data.session.user);
        }
      }
    };

    const urlSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
