import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Mail, RefreshCw, LogOut } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';

export default function VerifyEmailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const [loading, setLoading] = React.useState(false);

  const checkVerification = async () => {
    setLoading(true);
    const { data: { user: updatedUser }, error } = await supabase.auth.getUser();
    setLoading(false);
    
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (updatedUser?.email_confirmed_at) {
      router.replace('/(tabs)/home');
    } else {
      Alert.alert('Not Verified', 'We still haven\'t received your verification. Please check your email and click the link.');
    }
  };

    const resendEmail = async () => {
      if (!user?.email) return;
      setLoading(true);
      
      try {
        const response = await apiRequest('/auth/resend-verification', {
          method: 'POST',
          body: JSON.stringify({
            email: user.email,
          }),
        });

        if (response.error) {
          Alert.alert('Error', response.error);
        } else {
          Alert.alert('Sent', 'A new welcome and verification email has been sent to your registered email address.');
        }
      } catch (err: any) {
        Alert.alert('Error', 'Failed to resend email. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-8 justify-center items-center">
        <View className="w-24 h-24 bg-primary/10 rounded-full items-center justify-center mb-8">
          <Mail size={48} color={theme.primary} />
        </View>
        
        <Text className="text-3xl font-black text-foreground text-center mb-4 uppercase tracking-tighter">
          Check Your Email
        </Text>
        
        <Text className="text-base text-muted-foreground text-center mb-10 font-medium leading-6">
          We've sent a verification link to{"\n"}
          <Text className="text-foreground font-bold">{user?.email}</Text>{"\n"}
          Please click the link to verify your account.
        </Text>

        <TouchableOpacity 
          onPress={checkVerification}
          disabled={loading}
          className="w-full bg-primary h-16 rounded-2xl items-center justify-center shadow-lg mb-4"
        >
          {loading ? (
            <RefreshCw size={24} color={theme.primaryForeground} className="animate-spin" />
          ) : (
            <Text className="text-primaryForeground font-black text-lg uppercase">I've Verified</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={resendEmail}
          disabled={loading}
          className="w-full h-16 rounded-2xl items-center justify-center border border-border"
        >
          <Text className="text-foreground font-bold text-base">Resend Email</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleSignOut}
          className="mt-12 flex-row items-center"
        >
          <LogOut size={20} color={theme.mutedForeground} className="mr-2" />
          <Text className="text-muted-foreground font-bold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
