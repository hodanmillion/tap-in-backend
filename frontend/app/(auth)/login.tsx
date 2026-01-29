import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { ChevronRight } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

      async function signInWithEmail() {
        if (!email || !password) {
          Alert.alert('Error', 'Please enter both email and password');
          return;
        }

        setLoading(true);
        
          const rawIdentifier = email.trim();
          const rawPassword = password.trim();
          let authIdentifier = rawIdentifier.toLowerCase();
          
            try {
              // Support Login with Username or Email
              const identifiersToTry = new Set<string>();
              
              // Always add the raw input (normalized)
              identifiersToTry.add(authIdentifier);

              // 1. Try to find a profile by email OR username (exact match preferred)
              console.log(`Searching profile for: ${authIdentifier}`);
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('username, email')
                .or(`email.eq.${authIdentifier},username.eq.${authIdentifier}`)
                .maybeSingle();
              
              if (profileError) console.warn('Profile search error:', profileError);
              
                if (profileData) {
                  console.log('Profile found:', profileData);
                  // If we found a profile, try its canonical internal email AND its real email
                  if (profileData.username) {
                    identifiersToTry.add(`${profileData.username.toLowerCase()}@tapin.internal`);
                  }
                  if (profileData.email) {
                    identifiersToTry.add(profileData.email.toLowerCase());
                  }
                } else if (!authIdentifier.includes('@')) {
                // If no profile found but it's not an email, try the internal format anyway
                identifiersToTry.add(`${authIdentifier}@tapin.internal`);
              }

              const attemptList = Array.from(identifiersToTry);
              console.log(`Login sequence: ${attemptList.join(' -> ')}`);
              
              let lastError = null;
              let success = false;

              for (const identifier of attemptList) {
                console.log(`Trying auth: ${identifier}`);
                const { data, error } = await supabase.auth.signInWithPassword({
                  email: identifier,
                  password: rawPassword,
                });

                if (!error) {
                  console.log(`Successfully signed in with: ${identifier}`);
                  success = true;
                  break;
                }
                
                lastError = error;
                console.log(`Failed with ${identifier}: ${error.message}`);
                
                // If it's a critical error (rate limit, etc), stop
                if (!error.message.includes('Invalid login credentials') && !error.message.includes('Email not found')) {
                  break;
                }
              }

            if (!success && lastError) {
              console.error('Login failed after all attempts:', lastError.message);
              
              if (lastError.message.includes('Invalid login credentials')) {
                Alert.alert(
                  'Login Failed', 
                  'Invalid email/username or password. Please try again or create a new account.'
                );
              } else {
                Alert.alert('Error', lastError.message);
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
