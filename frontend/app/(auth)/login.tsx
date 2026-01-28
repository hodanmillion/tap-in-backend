import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { ChevronRight, Mail, Lock } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

      async function signInWithEmail() {
        if (!email || !password) {
          Alert.alert('Error', 'Please enter both email and password');
          return;
        }

        setLoading(true);
        
        const rawIdentifier = email.trim();
        let authIdentifier = rawIdentifier.toLowerCase();
        
        try {
          // Support Login with Username or Email
          if (authIdentifier.includes('@')) {
            // If it's an email, we need to find the username to get the internal auth email
            // We use ilike for case-insensitive lookup
            console.log(`Checking profile for email: ${authIdentifier}`);
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('username')
              .ilike('email', authIdentifier)
              .maybeSingle();
            
            if (profileData?.username) {
              console.log(`Found profile for ${authIdentifier}, using internal email for ${profileData.username}`);
              authIdentifier = `${profileData.username.toLowerCase()}@tapin.internal`;
            } else {
              // Fallback: If no profile found, try logging in with the raw email directly
              // This supports users registered before the internal email system
              console.log(`No profile found for ${authIdentifier}. Error:`, profileError);
              authIdentifier = rawIdentifier;
            }
          } else {
            // If it's just a username, convert to internal format
            authIdentifier = `${authIdentifier.toLowerCase()}@tapin.internal`;
          }

          console.log(`Attempting login with identifier: ${authIdentifier}`);
          const { data, error } = await supabase.auth.signInWithPassword({
            email: authIdentifier,
            password: password,
          });

            if (error) {
              console.error('Login failed:', error.message);
              if (error.message.includes('Invalid login credentials')) {
                // Check if user exists in auth but lacks a profile (rare split-brain case)
                const { data: authCheck } = await supabase.auth.signInWithPassword({
                  email: authIdentifier,
                  password: 'dummy-password-check',
                });
                
                if (authCheck.user) {
                   Alert.alert('Profile Missing', 'Your account exists but your profile is missing. Please contact support.');
                } else {
                  Alert.alert(
                    'Login Failed', 
                    'Invalid email or password. If you recently registered, please ensure you are using the same email. If the problem persists, try registering a new account.'
                  );
                }
              } else {
                Alert.alert('Error', error.message);
              }
            }
        } catch (err: any) {
          console.error('Unexpected login error:', err);
          Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        } finally {
          setLoading(false);
        }
      }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }} 
            className="px-6"
            keyboardShouldPersistTaps="handled"
          >
                <View className="items-center mb-10">
                  <Logo size="xl" className="mb-6" />
                  <Text className="text-4xl font-black text-foreground tracking-tighter text-center">TapIn</Text>
                  <Text className="mt-3 text-center text-base font-semibold text-muted-foreground px-6 leading-tight">
                    Welcome back. Your connections are waiting.
                  </Text>
                </View>

                <View>
                  <View className="mb-4">
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Email</Text>
                    <Input
                      placeholder="email@example.com"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      className="h-14 rounded-2xl bg-secondary/40 border-0 px-5 font-semibold"
                    />
                  </View>
  
                  <View className="mb-4">
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Password</Text>
                    <Input
                      placeholder="••••••••"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      className="h-14 rounded-2xl bg-secondary/40 border-0 px-5 font-semibold"
                    />
                  </View>

                <TouchableOpacity className="self-end mt-1 py-2">
                  <Text className="text-xs font-bold text-primary uppercase tracking-widest">Forgot Password?</Text>
                </TouchableOpacity>

                  <TouchableOpacity
                    onPress={signInWithEmail}
                    disabled={loading}
                    className="mt-8 bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/20 active:opacity-90"
                  >
                    <View className="flex-row items-center">
                      <Text className="text-base font-bold text-primary-foreground uppercase tracking-widest">Sign In</Text>
                      <ChevronRight size={18} color={theme.primaryForeground} className="ml-2" />
                    </View>
                  </TouchableOpacity>


              <View className="mt-12 flex-row justify-center items-center gap-2">
                <Text className="text-sm font-bold text-muted-foreground uppercase tracking-widest">New here?</Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity>
                    <Text className="text-sm font-black text-primary uppercase tracking-widest">Create Account</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              </View>
  
            <View className="pb-8 items-center">
            <Text className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">
              Securim Inc. • v15.0.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
