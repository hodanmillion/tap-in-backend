import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { ChevronRight, User, Mail, Lock } from 'lucide-react-native';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

      async function signUpWithEmail() {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password || !fullName) {
          Alert.alert('Error', 'Please fill in all fields');
          return;
        }

        setLoading(true);
          try {
              // Generate a safe username: lowercase, alphanumeric, dots, and underscores only
              const emailPrefix = trimmedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '');
              
              // First check if the email prefix itself is available as a username
              const { data: existing } = await supabase
                .from('profiles')
                .select('username')
                .ilike('username', emailPrefix)
                .maybeSingle();

              const generatedUsername = existing 
                ? emailPrefix + Math.floor(Math.random() * 1000)
                : emailPrefix;
              
              const response = await apiRequest('/auth/signup', {

            method: 'POST',
            body: JSON.stringify({
              email: trimmedEmail,
              password,
              full_name: fullName,
              username: generatedUsername,
            }),
          });
  
        if (response.error) {
          if (response.error.includes('Email is already registered')) {
            Alert.alert(
              'Account Exists',
              'An account with this email already exists. Would you like to log in instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log In', onPress: () => router.push('/(auth)/login') }
              ]
            );
          } else {
            Alert.alert('Error', response.error);
          }
          } else {
            Alert.alert(
              'Success', 
              `Account created! Your username is: ${generatedUsername}\n\nYou can now log in using this username or your email.`,
              [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
            );
          }
      } catch (err: any) {
      console.error('Registration error:', err);
      Alert.alert('Error', err.message || 'An unexpected error occurred during registration.');
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
                  <Text className="text-4xl font-black text-foreground tracking-tighter text-center">Join TapIn</Text>
                  <Text className="mt-3 text-center text-base font-semibold text-muted-foreground px-6 leading-tight">
                    Start connecting with the world around you.
                  </Text>
                </View>

                <View>
                  <View className="mb-4">
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Full Name</Text>
                    <Input
                      placeholder="John Doe"
                      value={fullName}
                      onChangeText={setFullName}
                      className="h-14 rounded-2xl bg-secondary/40 border-0 px-5 font-semibold"
                    />
                  </View>
  
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

                <TouchableOpacity
                  onPress={signUpWithEmail}
                  disabled={loading}
                  className="mt-8 bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/20 active:opacity-90"
                >
                  <View className="flex-row items-center">
                    <Text className="text-base font-bold text-primary-foreground uppercase tracking-widest">Get Started</Text>
                    <ChevronRight size={18} color={theme.primaryForeground} className="ml-2" />
                  </View>
                </TouchableOpacity>


              <View className="mt-12 flex-row justify-center items-center gap-2">
                <Text className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Already a member?</Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text className="text-sm font-black text-primary uppercase tracking-widest">Sign In</Text>
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
