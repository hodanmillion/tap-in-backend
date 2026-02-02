import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn('Profile fetch error:', error.message);
        
        // SELF-REPAIR: If profile is missing but user is authenticated
        if (error.message.includes('No object found') || error.code === 'PGRST116') {
          console.log('Auth: Profile missing, attempting self-repair...');
          try {
            const { data: userData } = await supabase.auth.getUser();
            const user = userData.user;
            if (user) {
              const { error: insertError } = await supabase.from('profiles').insert({
                id: user.id,
                full_name: user.user_metadata?.full_name || '',
                username: user.user_metadata?.username || user.email?.split('@')[0],
                email: user.user_metadata?.real_email || user.email
              });
              if (!insertError) {
                console.log('Auth: Profile repaired successfully');
                await fetchProfile(userId); // Retry fetch
                return;
              } else {
                console.error('Auth: Profile repair failed:', insertError.message);
              }
            }
          } catch (repairErr) {
            console.error('Auth: Unexpected error during profile repair:', repairErr);
          }
        }
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout: ensure loading is ALWAYS false after 6s for better UX
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timed out after 6s, forcing loading to false');
        setLoading(false);
      }
    }, 6000);

    const checkSession = async () => {
      console.log('Auth: Starting session check...');
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) {
          console.log('Auth: Component unmounted during session check');
          return;
        }

        if (error) {
          console.warn('Auth: Get session error:', error.message);
          setLoading(false);
          return;
        }
        
        console.log('Auth: Session retrieved:', currentSession ? 'Found' : 'Not found');
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          console.log('Auth: User found, fetching profile in background...');
          // SET LOADING FALSE IMMEDIATELY - Don't wait for profile
          setLoading(false);
          fetchProfile(currentUser.id).then(() => {
            console.log('Auth: Background profile fetch complete');
          });
        } else {
          console.log('Auth: No user found, setting loading to false');
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth: Initialization error:', err);
        if (mounted) setLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth: Auth state change event:', event);
      if (!mounted) return;
      
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        // Always ensure loading is false if we have a user
        setLoading(false);
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const handleDeepLink = async (url: string) => {
      if (!url || !mounted) return;
      
      try {
        const { queryParams } = Linking.parse(url);
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
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (!mounted) return;
          
          if (error) {
            console.error('Error setting session from deep link:', error.message);
          } else if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      } catch (err) {
        console.error('Deep link handling error:', err);
      }
    };

    const urlSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    }).catch(err => console.error('Error getting initial URL:', err));

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      if (urlSubscription && typeof urlSubscription.remove === 'function') {
        urlSubscription.remove();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
