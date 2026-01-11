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
    setLoading(true);
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else if (user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          full_name: fullName,
          username: email.split('@')[0] + Math.floor(Math.random() * 1000),
        });

        if (profileError) console.error('Profile creation error:', profileError);

        try {
          await apiRequest('/auth/welcome', {
            method: 'POST',
            body: JSON.stringify({
              id: user.id,
              email: email,
              full_name: fullName,
            }),
          });
        } catch (emailErr) {
          console.error('Failed to send welcome email:', emailErr);
        }

        Alert.alert('Success', 'Check your email for verification link!');
        router.replace('/(auth)/login');
      }
    } catch (err) {
      console.error('Registration error:', err);
      Alert.alert('Error', 'An unexpected error occurred during registration.');
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
          className="px-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center py-12">
            <View className="items-center mb-10">
              <Logo size="md" className="mb-6 shadow-xl" />
              <Text className="text-4xl font-black text-foreground tracking-tight">Create Account</Text>
              <Text className="mt-2 text-center text-base font-medium text-muted-foreground px-4">
                Connecting people through technology
              </Text>
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 ml-1">Full Name</Text>
                <Input
                  placeholder="John Doe"
                  value={fullName}
                  onChangeText={setFullName}
                  className="h-16 rounded-[20px] bg-secondary/30 border-0 px-6 font-bold"
                />
              </View>

              <View>
                <Text className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 ml-1">Email</Text>
                <Input
                  placeholder="email@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="h-16 rounded-[20px] bg-secondary/30 border-0 px-6 font-bold"
                />
              </View>

              <View>
                <Text className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 ml-1">Password</Text>
                <Input
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  className="h-16 rounded-[20px] bg-secondary/30 border-0 px-6 font-bold"
                />
              </View>

              <TouchableOpacity
                onPress={signUpWithEmail}
                disabled={loading}
                className="mt-10 bg-primary h-16 rounded-[24px] items-center justify-center shadow-xl shadow-primary/30 active:opacity-90"
              >
                <View className="flex-row items-center">
                  <Text className="text-lg font-black text-primary-foreground uppercase tracking-[0.1em]">Get Started</Text>
                  <ChevronRight size={20} color={theme.primaryForeground} className="ml-2" />
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
