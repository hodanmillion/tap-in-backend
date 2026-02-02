import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Camera, User, MapPin, Linkedin, Instagram, Link, X, Clipboard as ClipboardIcon } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

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
    linkedin_url: '',
    instagram_url: '',
  });

  const handlePaste = async (field: keyof typeof formData) => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setFormData(prev => ({ ...prev, [field]: text }));
    }
  };

  const handleClear = (field: keyof typeof formData) => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const getCurrentLocation = async () => {
    setFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to use this feature.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const reverse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (reverse && reverse.length > 0) {
        const address = reverse[0];
        let locationName = '';
        const street = address.street;
        const streetNumber = address.streetNumber;
        const name = address.name;
        const city = address.city || '';
        const district = address.district || '';
        
        if (street && street !== 'Unnamed Road') {
          locationName = streetNumber ? `${streetNumber} ${street}` : street;
        } else if (name && name !== 'Unnamed Road') {
          locationName = name;
        } else if (district) {
          locationName = `${district}, ${city}`;
        } else if (city) {
          locationName = city;
        }
        
        setFormData((prev) => ({ ...prev, location_name: locationName || 'Unknown Location' }));
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setFetchingLocation(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        occupation: profile.occupation || '',
        location_name: profile.location_name || '',
        website: profile.website || '',
        linkedin_url: profile.linkedin_url || '',
        instagram_url: profile.instagram_url || '',
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
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets[0].uri) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}.jpg`;
      
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfileMutation.mutateAsync({ avatar_url: `${publicUrl}?v=${Date.now()}` });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

      const handleUpdateProfile = async () => {
        if (!profile) return;

        // Validate username
        const usernameRegex = /^[a-zA-Z0-9._]+$/;
        if (formData.username && !usernameRegex.test(formData.username)) {
          Alert.alert('Invalid Username', 'Username can only contain letters, numbers, dots, and underscores.');
          return;
        }

        setUploading(true);
      try {
        const updates: any = {};
        if (formData.full_name !== (profile.full_name || '')) updates.full_name = formData.full_name;
        if (formData.username !== (profile.username || '')) updates.username = formData.username;
        if (formData.bio !== (profile.bio || '')) updates.bio = formData.bio;
        if (formData.occupation !== (profile.occupation || '')) updates.occupation = formData.occupation;
        if (formData.location_name !== (profile.location_name || '')) updates.location_name = formData.location_name;
        if (formData.website !== (profile.website || '')) updates.website = formData.website;
        if (formData.linkedin_url !== (profile.linkedin_url || '')) updates.linkedin_url = formData.linkedin_url;
        if (formData.instagram_url !== (profile.instagram_url || '')) updates.instagram_url = formData.instagram_url;

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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-6">
            <View className="items-center mb-8">
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
              {/* Profile Details Section */}
              <View className="gap-6">
                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Full Name</Text>
                  <TextInput
                    className="bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.full_name}
                    onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.mutedForeground}
                  />
                </View>

                <View>
                  <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Username</Text>
                  <TextInput
                    className="bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
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
                    className="bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-medium text-base h-32"
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
                    className="bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.occupation}
                    onChangeText={(text) => setFormData({ ...formData, occupation: text })}
                    placeholder="What do you do?"
                    placeholderTextColor={theme.mutedForeground}
                  />
                </View>

                <View>
                  <View className="flex-row items-center justify-between mb-2 ml-1">
                    <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest">Location</Text>
                    <TouchableOpacity 
                      onPress={getCurrentLocation}
                      disabled={fetchingLocation}
                      className="flex-row items-center"
                    >
                      {fetchingLocation ? (
                        <ActivityIndicator size="small" color={theme.primary} className="mr-1" />
                      ) : (
                        <MapPin size={14} color={theme.primary} className="mr-1" />
                      )}
                      <Text className="text-xs font-bold text-primary">Use Current Location</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    className="bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                    value={formData.location_name}
                    onChangeText={(text) => setFormData({ ...formData, location_name: text })}
                    placeholder="e.g. London, UK"
                    placeholderTextColor={theme.mutedForeground}
                  />
                </View>
              </View>

              {/* Social Links Section */}
              <View className="mt-8">
                <Text className="text-sm font-black text-foreground uppercase tracking-widest mb-4 ml-1">Social Links</Text>
                
                <View className="gap-4">
                  <View>
                    <View className="flex-row items-center mb-2 ml-1">
                      <Link size={14} color={theme.mutedForeground} className="mr-2" />
                      <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest">Website</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                        value={formData.website}
                        onChangeText={(text) => setFormData({ ...formData, website: text })}
                        placeholder="https://..."
                        placeholderTextColor={theme.mutedForeground}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                      {formData.website ? (
                        <TouchableOpacity 
                          onPress={() => handleClear('website')}
                          className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary/30"
                        >
                          <X size={20} color={theme.mutedForeground} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => handlePaste('website')}
                          className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
                        >
                          <ClipboardIcon size={20} color={theme.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View>
                    <View className="flex-row items-center mb-2 ml-1">
                      <Linkedin size={14} color="#0077B5" className="mr-2" />
                      <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest">LinkedIn</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                        value={formData.linkedin_url}
                        onChangeText={(text) => setFormData({ ...formData, linkedin_url: text })}
                        placeholder="Paste profile URL or username"
                        placeholderTextColor={theme.mutedForeground}
                        autoCapitalize="none"
                      />
                      {formData.linkedin_url ? (
                        <TouchableOpacity 
                          onPress={() => handleClear('linkedin_url')}
                          className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary/30"
                        >
                          <X size={20} color={theme.mutedForeground} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => handlePaste('linkedin_url')}
                          className="h-14 w-14 items-center justify-center rounded-2xl bg-[#0077B5]/10"
                        >
                          <ClipboardIcon size={20} color="#0077B5" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text className="text-[10px] text-muted-foreground mt-1 ml-2">Tip: Copy your profile link from the LinkedIn app and paste it here.</Text>
                  </View>

                  <View>
                    <View className="flex-row items-center mb-2 ml-1">
                      <Instagram size={14} color="#E4405F" className="mr-2" />
                      <Text className="text-xs font-black text-muted-foreground uppercase tracking-widest">Instagram</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 bg-card border border-border/50 rounded-2xl px-5 py-4 text-foreground font-bold text-lg"
                        value={formData.instagram_url}
                        onChangeText={(text) => setFormData({ ...formData, instagram_url: text })}
                        placeholder="@username"
                        placeholderTextColor={theme.mutedForeground}
                        autoCapitalize="none"
                      />
                      {formData.instagram_url ? (
                        <TouchableOpacity 
                          onPress={() => handleClear('instagram_url')}
                          className="h-14 w-14 items-center justify-center rounded-2xl bg-secondary/30"
                        >
                          <X size={20} color={theme.mutedForeground} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => handlePaste('instagram_url')}
                          className="h-14 w-14 items-center justify-center rounded-2xl bg-[#E4405F]/10"
                        >
                          <ClipboardIcon size={20} color="#E4405F" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleUpdateProfile}
              disabled={updateProfileMutation.isPending}
              className="mt-12 bg-primary py-6 rounded-[32px] items-center shadow-xl shadow-primary/30"
            >
              {updateProfileMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-lg font-black text-white uppercase tracking-widest">Save Changes</Text>
              )}
            </TouchableOpacity>
            
            <View className="h-20" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

}

