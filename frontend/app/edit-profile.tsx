import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Camera, User } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import * as ImagePicker from 'expo-image-picker';

const decodeBase64 = (base64: string) => {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error('Base64 decode error:', e);
    throw new Error('Failed to process image data');
  }
};

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading: profileIsLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
    occupation: '',
    location_name: '',
    website: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        occupation: profile.occupation || '',
        location_name: profile.location_name || '',
        website: profile.website || '',
      });
    }
  }, [profile]);

    const updateProfileMutation = useMutation({
      mutationFn: async (updates: any) => {
        if (!user?.id) throw new Error('User not logged in');
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
        Alert.alert('Success', 'Profile updated successfully!');
        router.back();
      },
      onError: (error: any) => {
        Alert.alert('Error', error.message);
      },
    });

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        uploadAvatar(result.assets[0].base64);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (base64: string) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, decodeBase64(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfileMutation.mutateAsync({ avatar_url: publicUrl });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

    const handleUpdateProfile = async () => {
      if (!profile) return;
      setUploading(true);
      try {
        const updates: any = {};
        if (formData.full_name !== (profile.full_name || '')) updates.full_name = formData.full_name;
        if (formData.username !== (profile.username || '')) updates.username = formData.username;
        if (formData.bio !== (profile.bio || '')) updates.bio = formData.bio;
        if (formData.occupation !== (profile.occupation || '')) updates.occupation = formData.occupation;
        if (formData.location_name !== (profile.location_name || '')) updates.location_name = formData.location_name;
        if (formData.website !== (profile.website || '')) updates.website = formData.website;

        // If location name changed, try to geocode it to update coordinates
        if (updates.location_name) {
          try {
            const geocoded = await Location.geocodeAsync(updates.location_name);
            if (geocoded && geocoded.length > 0) {
              updates.latitude = geocoded[0].latitude;
              updates.longitude = geocoded[0].longitude;
              updates.location = `POINT(${geocoded[0].longitude} ${geocoded[0].latitude})`;
            }
          } catch (geoErr) {
            console.warn('Geocoding failed for manual address:', geoErr);
          }
        }

        if (Object.keys(updates).length === 0) {
          router.back();
          return;
        }

        await updateProfileMutation.mutateAsync(updates);
      } catch (err: any) {
        Alert.alert('Error', err.message);
      } finally {
        setUploading(false);
      }
    };

  if (profileIsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center px-4 py-4 border-b border-border/30">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary/50"
        >
          <ChevronLeft size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text className="ml-4 text-xl font-black text-foreground uppercase tracking-widest">Edit Profile</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-8">
          <View className="items-center mb-10">
            <TouchableOpacity 
              onPress={pickImage}
              disabled={uploading}
              className="h-32 w-32 items-center justify-center rounded-[40px] bg-card border-4 border-background shadow-lg overflow-hidden"
            >
              {uploading ? (
                <ActivityIndicator color={theme.primary} />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-full w-full" />
              ) : (
                <User size={48} color={theme.mutedForeground} opacity={0.3} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={pickImage}
              className="mt-4 bg-primary/10 px-4 py-2 rounded-xl"
            >
              <Text className="text-xs font-black text-primary uppercase tracking-widest">Change Photo</Text>
            </TouchableOpacity>
          </View>

          <View className="space-y-6">
            <View>
              <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Full Name</Text>
              <TextInput
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                placeholder="Enter your full name"
                placeholderTextColor={theme.mutedForeground}
              />
            </View>

            <View>
              <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Username</Text>
              <TextInput
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                placeholder="Enter username"
                placeholderTextColor={theme.mutedForeground}
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Bio</Text>
              <TextInput
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-medium text-base h-32"
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder="Tell the world about yourself..."
                placeholderTextColor={theme.mutedForeground}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View>
              <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Occupation</Text>
              <TextInput
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                value={formData.occupation}
                onChangeText={(text) => setFormData({ ...formData, occupation: text })}
                placeholder="What do you do?"
                placeholderTextColor={theme.mutedForeground}
              />
            </View>

            <View>
              <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Location</Text>
              <TextInput
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                value={formData.location_name}
                onChangeText={(text) => setFormData({ ...formData, location_name: text })}
                placeholder="e.g. London, UK"
                placeholderTextColor={theme.mutedForeground}
              />
            </View>

            <View>
              <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Website</Text>
              <TextInput
                className="bg-card border border-border rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                value={formData.website}
                onChangeText={(text) => setFormData({ ...formData, website: text })}
                placeholder="https://..."
                placeholderTextColor={theme.mutedForeground}
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleUpdateProfile}
            disabled={updateProfileMutation.isPending}
            className="mt-10 bg-primary py-6 rounded-[32px] items-center shadow-xl shadow-primary/30"
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <Text className="text-lg font-black text-primary-foreground uppercase tracking-widest">Save Changes</Text>
            )}
          </TouchableOpacity>
          
          <View className="h-10" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { Image } from 'react-native';
