import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Camera, ImageIcon, Send, X, User, Check, Users, Sparkles } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn, FadeInUp } from 'react-native-reanimated';

export default function SendTapinScreen() {
  const { user } = useAuth();
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(params.friendId as string || null);
  const [uploading, setUploading] = useState(false);

  const { data: friendsData, isLoading, error: friendsError } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: () => apiRequest(`/friends/${user?.id}`),
    enabled: !!user?.id,
    retry: 2,
  });

  const friends = useMemo(() => {
    if (!friendsData) return [];
    return Array.isArray(friendsData) ? friendsData : [];
  }, [friendsData]);

  const sendTapinMutation = useMutation({
    mutationFn: async (data: { receiver_id: string; image_url: string; caption?: string }) => {
      return apiRequest('/tapins', {
        method: 'POST',
        body: JSON.stringify({
          sender_id: user?.id,
          ...data,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tapins'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent!', 'Your tapin has been sent', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
      onError: (error: any) => {
        const msg = error.message || 'Failed to send tapin';
        if (msg.includes('404')) {
          Alert.alert('Service Unavailable', 'The backend server needs to be updated. Please try again later.');
        } else {
          Alert.alert('Error', msg);
        }
      },
  });

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', `Please grant ${useCamera ? 'camera' : 'photo library'} access`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const uploadAndSend = async () => {
    if (!selectedImage || !selectedFriend || !user?.id) return;
    
    setUploading(true);
    try {
      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('lockets')
        .upload(fileName, arrayBuffer, { 
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('lockets').getPublicUrl(fileName);

      await sendTapinMutation.mutateAsync({
        receiver_id: selectedFriend,
        image_url: urlData.publicUrl,
        caption: caption.trim() || undefined,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

return (
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <View className="flex-row items-center justify-between px-5 py-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <ChevronLeft size={20} color={theme.foreground} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-foreground">Send Photo</Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.springify()} className="p-5">
                {!selectedImage ? (
                    <View className="aspect-[3/4] rounded-3xl bg-card border border-border/30 items-center justify-center overflow-hidden">
                      <View className="items-center gap-5 p-8">
                        <View className="h-16 w-16 rounded-2xl bg-primary/10 items-center justify-center">
                          <Sparkles size={28} color={theme.primary} />
                        </View>
                        <View className="items-center">
                          <Text className="text-foreground text-lg font-bold">Share a moment</Text>
                          <Text className="text-muted-foreground text-sm mt-1.5 text-center px-4">
                            Take a photo or pick from gallery
                          </Text>
                        </View>
                        <View className="flex-row gap-4 mt-4">
                          <TouchableOpacity
                            onPress={() => pickImage(true)}
                            activeOpacity={0.8}
                            className="items-center">
                            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
                              <Camera size={26} color="#fff" strokeWidth={2} />
                            </View>
                            <Text className="text-xs font-semibold text-foreground mt-2">Camera</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => pickImage(false)}
                            activeOpacity={0.8}
                            className="items-center">
                            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border">
                              <ImageIcon size={26} color={theme.mutedForeground} strokeWidth={2} />
                            </View>
                            <Text className="text-xs font-semibold text-muted-foreground mt-2">Gallery</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Animated.View entering={FadeIn} className="aspect-[3/4] rounded-3xl overflow-hidden relative bg-neutral-900">
                      <Image
                        source={{ uri: selectedImage }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        onPress={() => setSelectedImage(null)}
                        activeOpacity={0.8}
                        className="absolute top-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-black/50">
                        <X size={20} color="#fff" />
                      </TouchableOpacity>
                      <View className="absolute bottom-3 left-3 right-3">
                        <TouchableOpacity
                          onPress={() => pickImage(true)}
                          activeOpacity={0.8}
                          className="h-10 rounded-xl bg-white/15 items-center justify-center flex-row gap-2">
                          <Camera size={16} color="#fff" />
                          <Text className="text-white font-semibold text-sm">Retake</Text>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  )}

              <Animated.View entering={FadeInDown.delay(100).springify()} className="mt-5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 ml-1">Caption</Text>
                <TextInput
                  className="bg-card border border-border/50 rounded-xl px-4 py-3.5 text-foreground text-base"
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption..."
                  placeholderTextColor={theme.mutedForeground}
                  maxLength={100}
                />
                <Text className="text-[10px] text-muted-foreground mt-1.5 ml-1">{caption.length}/100</Text>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(150).springify()} className="mt-5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 ml-1">Send to</Text>
                {isLoading ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : friendsError ? (
                  <View className="bg-card border border-destructive/20 rounded-xl p-5 items-center">
                    <Text className="text-foreground font-semibold text-sm text-center">
                      Failed to load friends
                    </Text>
                    <Text className="text-muted-foreground text-center mt-1 text-xs">
                      {(friendsError as Error)?.message || 'Check your connection'}
                    </Text>
                  </View>
                ) : friends.length === 0 ? (
                  <View className="bg-card border border-border/50 rounded-xl p-5 items-center">
                    <View className="h-12 w-12 rounded-xl bg-secondary items-center justify-center mb-2">
                      <Users size={20} color={theme.mutedForeground} />
                    </View>
                    <Text className="text-foreground font-semibold text-sm">No friends yet</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/users')}
                      activeOpacity={0.8}
                      className="mt-3 px-5 py-2.5 rounded-xl bg-primary">
                      <Text className="text-primary-foreground font-semibold text-sm">Find Friends</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="gap-2">
                    {friends.map((friend: any, index: number) => (
                      <Animated.View key={friend.id} entering={FadeInUp.delay(index * 40).springify()}>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedFriend(friend.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          activeOpacity={0.8}
                          className={`flex-row items-center p-3 rounded-xl ${
                            selectedFriend === friend.id
                              ? 'bg-primary/10 border-2 border-primary'
                              : 'bg-card border border-border/40'
                          }`}>
                          <View className={`h-11 w-11 rounded-xl overflow-hidden items-center justify-center ${
                            selectedFriend === friend.id ? 'bg-primary/20' : 'bg-secondary'
                          }`}>
                            {friend.avatar_url ? (
                              <Image
                                source={{ uri: friend.avatar_url }}
                                style={{ width: 44, height: 44 }}
                                contentFit="cover"
                              />
                            ) : (
                              <User size={18} color={selectedFriend === friend.id ? theme.primary : theme.mutedForeground} />
                            )}
                          </View>
                          <View className="ml-3 flex-1">
                            <Text className={`text-sm font-semibold ${selectedFriend === friend.id ? 'text-primary' : 'text-foreground'}`}>
                              {friend.full_name || friend.username || 'Friend'}
                            </Text>
                            {friend.username && (
                              <Text className="text-xs text-muted-foreground">@{friend.username}</Text>
                            )}
                          </View>
                          {selectedFriend === friend.id && (
                            <View className="h-7 w-7 rounded-lg bg-primary items-center justify-center">
                              <Check size={14} color="#fff" strokeWidth={3} />
                            </View>
                          )}
                        </TouchableOpacity>
                      </Animated.View>
                    ))}
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          </ScrollView>

          <View className="px-5 pb-6 pt-3 bg-background border-t border-border/30">
              <TouchableOpacity
                onPress={uploadAndSend}
                disabled={!selectedImage || !selectedFriend || uploading}
                activeOpacity={0.9}
                className={`h-14 rounded-2xl flex-row items-center justify-center gap-2 ${
                  !selectedImage || !selectedFriend
                    ? 'bg-muted'
                    : 'bg-primary'
                }`}>
                {uploading ? (
                  <ActivityIndicator color={!selectedImage || !selectedFriend ? theme.mutedForeground : '#fff'} size="small" />
                ) : (
                  <>
                    <Send 
                      size={18} 
                      color={!selectedImage || !selectedFriend ? theme.mutedForeground : '#fff'} 
                      strokeWidth={2.5} 
                    />
                    <Text
                      className={`text-base font-bold ${
                        !selectedImage || !selectedFriend ? 'text-muted-foreground' : 'text-primary-foreground'
                      }`}>
                      Send Photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
        </SafeAreaView>
      );
}
