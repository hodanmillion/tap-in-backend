import React, { useState, useEffect } from 'react';
  import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
  } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  User, 
  Bell, 
  Shield, 
  CircleHelp, 
  CreditCard, 
  Trash2, 
  LogOut,
  Moon,
  Globe,
  Lock,
  EyeOff,
  Mail,
  Bug
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { apiRequest } from '@/lib/api';
import { ErrorBoundary } from '@/app/error-boundary';

function SettingsContent() {
  const { user } = useAuth();
  const { 
    requestPermissions, 
    schedulePushNotification, 
    permissionStatus,
    expoPushToken 
  } = useNotifications();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const [loading, setLoading] = useState(false);

    const [notifications, setNotifications] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(true);
    const [incognito, setIncognito] = useState(false);
    const [incognitoLoading, setIncognitoLoading] = useState(true);
    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
    const [updatingPassword, setUpdatingPassword] = useState(false);

    useEffect(() => {
      if (user?.id) {
        loadPreferences();
      }
    }, [user?.id]);

    async function loadPreferences() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('push_notifications_enabled, is_incognito')
          .eq('id', user?.id)
          .single();
        
        if (!error && data) {
          setNotifications(data.push_notifications_enabled ?? false);
          setIncognito(data.is_incognito ?? false);
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setNotificationsLoading(false);
        setIncognitoLoading(false);
      }
    }

    async function handleNotificationToggle(value: boolean) {
      if (value) {
        // When enabling, ensure we have permissions and token
        const token = await requestPermissions();
        if (!token) {
          Alert.alert(
            'Permissions Needed',
            'Please enable notifications in your device settings to receive alerts.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      setNotifications(value);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ push_notifications_enabled: value })
          .eq('id', user?.id);
        
        if (error) {
          setNotifications(!value);
          Alert.alert('Error', 'Failed to update notification preference');
        }
      } catch (err) {
        setNotifications(!value);
        Alert.alert('Error', 'Failed to update notification preference');
      }
    }

    async function handleIncognitoToggle(value: boolean) {
      setIncognito(value);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ is_incognito: value })
          .eq('id', user?.id);
        
        if (error) {
          setIncognito(!value);
          Alert.alert('Error', 'Failed to update incognito preference');
        }
      } catch (err) {
        setIncognito(!value);
        Alert.alert('Error', 'Failed to update incognito preference');
      }
    }

    async function handleTestNotification() {
      if (!notifications) {
        Alert.alert('Notifications Disabled', 'Please enable notifications first.');
        return;
      }
      
      try {
        await schedulePushNotification(
          'Test Notification 🔔',
          'This is a test notification from TapIn settings!',
          { type: 'test' }
        );
      } catch (err) {
        Alert.alert('Error', 'Failed to send test notification');
      }
    }

    async function handleUpdatePassword() {
      if (!passwords.newPassword || passwords.newPassword !== passwords.confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      setUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: passwords.newPassword });
      setUpdatingPassword(false);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Password updated successfully');
        setIsPasswordModalVisible(false);
        setPasswords({ newPassword: '', confirmPassword: '' });
      }
    }

    async function handleSignOut() {
      setLoading(true);

      // Clear push token from server if it exists
      if (user?.id && expoPushToken) {
        try {
          await apiRequest('/push-tokens', {
            method: 'DELETE',
            body: JSON.stringify({
              user_id: user.id,
              token: expoPushToken
            })
          });
        } catch (err) {
          console.error('Error deleting push token on logout:', err);
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
      }
    }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure? This action cannot be undone and all your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiRequest('/auth/delete-account', {
                method: 'DELETE',
                body: JSON.stringify({ userId: user?.id }),
              });
              handleSignOut();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete account.');
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    label, 
    value, 
    onPress, 
    isSwitch, 
    switchValue, 
    onSwitchChange,
    destructive 
  }: { 
    icon: React.ReactNode; 
    label: string; 
    value?: string; 
    onPress?: () => void; 
    isSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (val: boolean) => void;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={isSwitch}
      className={`flex-row items-center justify-between p-4 border-b border-border/50 active:bg-secondary/50`}>
      <View className="flex-row items-center flex-1">
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${destructive ? 'bg-destructive/10' : 'bg-secondary/50'}`}>
          {icon}
        </View>
        <Text className={`ml-4 text-base font-bold ${destructive ? 'text-destructive' : 'text-foreground'}`}>
          {label}
          </Text>
        </View>
        {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.muted, true: theme.primary }}
          thumbColor="#fff"
        />
      ) : (
        <View className="flex-row items-center">
          {value && <Text className="mr-2 text-sm text-muted-foreground font-semibold">{value}</Text>}
          {!destructive && <ChevronLeft size={18} color={theme.mutedForeground} opacity={0.3} style={{ transform: [{ rotate: '180deg' }] }} />}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-4 border-b border-border/30">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary/50"
        >
          <ChevronLeft size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text className="ml-4 text-xl font-black text-foreground uppercase tracking-widest">Settings</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-6">
          <View className="mb-8">
            <Text className="mb-4 ml-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Account</Text>
              <View className="overflow-hidden rounded-[28px] bg-card border border-border shadow-sm">
                <SettingItem 
                  icon={<User size={20} color={theme.primary} />} 
                  label="Edit Profile" 
                  onPress={() => router.push('/edit-profile')} 
                />
                <SettingItem 
                  icon={<Mail size={20} color={theme.primary} />} 
                  label="Email" 
                  value={user?.email} 
                />
                <SettingItem 
                  icon={<Lock size={20} color={theme.primary} />} 
                  label="Change Password" 
                  onPress={() => setIsPasswordModalVisible(true)}
                />
              </View>
            </View>


          <View className="mb-8">
            <Text className="mb-4 ml-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Preferences</Text>
            <View className="overflow-hidden rounded-[28px] bg-card border border-border shadow-sm">
              <SettingItem 
                icon={<Moon size={20} color={theme.mutedForeground} />} 
                label="Dark Mode" 
                isSwitch 
                switchValue={colorScheme === 'dark'} 
                onSwitchChange={toggleColorScheme} 
              />
                <SettingItem 
                    icon={<Bell size={20} color={theme.mutedForeground} />} 
                    label="Push Notifications" 
                    isSwitch 
                    switchValue={notifications} 
                    onSwitchChange={handleNotificationToggle} 
                  />
                {notifications && (
                  <SettingItem 
                    icon={<Bell size={20} color={theme.primary} />} 
                    label="Test Push Notification" 
                    onPress={handleTestNotification}
                  />
                )}

                <SettingItem 
                  icon={<EyeOff size={20} color={theme.mutedForeground} />} 
                  label="Incognito Mode" 
                  isSwitch 
                  switchValue={incognito} 
                  onSwitchChange={handleIncognitoToggle} 
                />
              <SettingItem 
                icon={<Globe size={20} color={theme.mutedForeground} />} 
                label="Language" 
                value="English" 
              />
            </View>
          </View>

            <View className="mb-8">
              <Text className="mb-4 ml-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">Security & Support</Text>
              <View className="overflow-hidden rounded-[28px] bg-card border border-border shadow-sm">
                <SettingItem 
                  icon={<Shield size={20} color={theme.mutedForeground} />} 
                  label="Privacy Policy" 
                  onPress={() => Alert.alert('Privacy Policy', 'Our privacy policy is coming soon.')}
                />
                <SettingItem 
                  icon={<CircleHelp size={20} color={theme.mutedForeground} />} 
                  label="Help Center" 
                  onPress={() => Alert.alert('Help Center', 'Our help center is coming soon.')}
                />
                <SettingItem 
                  icon={<CreditCard size={20} color={theme.mutedForeground} />} 
                  label="Subscription" 
                  value="Pro"
                  onPress={() => Alert.alert('Subscription', 'Manage your subscription options here. Feature coming soon.')}
                />
                <SettingItem 
                  icon={<Bug size={20} color={theme.mutedForeground} />} 
                  label="Debug & Performance" 
                  onPress={() => router.push('/debug')}
                />
              </View>
            </View>


          <View className="mb-12">
            <View className="overflow-hidden rounded-[28px] bg-card border border-border shadow-sm">
              <SettingItem 
                icon={<LogOut size={20} color={theme.destructive} />} 
                label="Sign Out" 
                onPress={handleSignOut}
                destructive
              />
              <SettingItem 
                icon={<Trash2 size={20} color={theme.destructive} />} 
                label="Delete Account" 
                onPress={handleDeleteAccount}
                destructive
              />
            </View>
          </View>

            <View className="items-center pb-10">
              <Text className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.5em]">TapIn v15.1.0</Text>
            </View>

        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isPasswordModalVisible}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background rounded-t-[40px] p-8">
            <View className="flex-row justify-between items-center mb-8">
              <Text className="text-3xl font-black text-foreground uppercase tracking-widest">Update Password</Text>
              <TouchableOpacity 
                onPress={() => setIsPasswordModalVisible(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
              >
                <ChevronLeft size={24} color={theme.foreground} style={{ transform: [{ rotate: '-90deg' }] }} />
              </TouchableOpacity>
            </View>

            <View className="space-y-6">
              <View>
                <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">New Password</Text>
                <TextInput
                  className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                  value={passwords.newPassword}
                  onChangeText={(text) => setPasswords({ ...passwords, newPassword: text })}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={theme.mutedForeground}
                  secureTextEntry
                />
              </View>

              <View>
                <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Confirm Password</Text>
                <TextInput
                  className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                  value={passwords.confirmPassword}
                  onChangeText={(text) => setPasswords({ ...passwords, confirmPassword: text })}
                  placeholder="Repeat your password"
                  placeholderTextColor={theme.mutedForeground}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                onPress={handleUpdatePassword}
                disabled={updatingPassword}
                className="mt-8 bg-primary py-6 rounded-[32px] items-center shadow-xl shadow-primary/30"
              >
                {updatingPassword ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Text className="text-lg font-black text-primary-foreground uppercase tracking-widest">Update Password</Text>
                )}
              </TouchableOpacity>
              
              <View className="h-10" />
            </View>
          </View>
        </View>
      </Modal>

      {(loading || updatingPassword) && (
        <View className="absolute inset-0 bg-black/20 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function SettingsScreen() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}
