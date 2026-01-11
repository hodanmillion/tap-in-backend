import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '@/lib/api';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        // Create profile in public.profiles
        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          full_name: fullName,
          username: email.split('@')[0] + Math.floor(Math.random() * 1000),
        });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        // Send tailored welcome email via backend
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
          // Don't block the user if email fails
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6">
          <View className="mb-10 mt-10">
            <Text className="text-4xl font-bold text-foreground">Join Tap In</Text>
            <Text className="mt-2 text-lg text-muted-foreground">
              Start connecting with people nearby.
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              label="Email"
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Password"
              placeholder="Min 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Button
              title="Create Account"
              onPress={signUpWithEmail}
              loading={loading}
              className="mt-4"
            />

            <View className="mt-6 flex-row justify-center gap-2">
              <Text className="text-muted-foreground">Already have an account?</Text>
              <Link href="/(auth)/login" asChild>
                <Text className="font-semibold text-primary">Sign In</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
