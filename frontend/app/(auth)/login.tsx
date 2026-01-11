import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          className="p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10 mt-10">
            <Text className="text-4xl font-bold text-foreground">Tap In</Text>
            <Text className="mt-2 text-lg text-muted-foreground">
              Connect with people around you in real time.
            </Text>
          </View>

          <View className="gap-4">
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
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Button title="Sign In" onPress={signInWithEmail} loading={loading} className="mt-4" />

            <View className="mt-6 flex-row justify-center gap-2">
              <Text className="text-muted-foreground">Don't have an account?</Text>
              <Link href="/(auth)/register" asChild>
                <Text className="font-semibold text-primary">Sign Up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
