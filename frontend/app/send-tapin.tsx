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
            className="h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border/50">
            <ChevronLeft size={22} color={theme.foreground} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            <LinearGradient
              colors={['#ec4899', '#f472b6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-8 w-8 rounded-xl items-center justify-center">
              <Camera size={16} color="#fff" />
            </LinearGradient>
            <Text className="text-lg font-black text-foreground tracking-tight">Send Img</Text>
          </View>
          <View className="w-11" />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.springify()} className="p-5">
              {!selectedImage ? (
                  <View className="aspect-[3/4] rounded-[40px] bg-card border border-border/40 items-center justify-center overflow-hidden">
                    <View className="items-center gap-6 p-8">
                      <View className="h-20 w-20 rounded-3xl bg-primary/10 items-center justify-center mb-2">
                        <Sparkles size={36} color={theme.primary} />
                      </View>
                      <View className="items-center">
                        <Text className="text-foreground text-xl font-black tracking-tight">Capture the moment</Text>
                        <Text className="text-muted-foreground text-sm font-medium mt-2 text-center px-4">
                          Take a photo or pick from your gallery to share with a friend
                        </Text>
                      </View>
                      <View className="flex-row gap-4 mt-2">
                        <TouchableOpacity
                          onPress={() => pickImage(true)}
                          activeOpacity={0.8}>
                          <LinearGradient
                            colors={['#fcd34d', '#f59e0b', '#d97706']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="h-[72px] w-[72px] items-center justify-center rounded-[24px] shadow-xl shadow-amber-500/40">
                            <Camera size={32} color="#000" strokeWidth={2} />
                          </LinearGradient>
                          <Text className="text-[11px] font-bold text-foreground mt-2 text-center">Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => pickImage(false)}
                          activeOpacity={0.8}
                          className="items-center">
                          <View className="h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-secondary border border-border/50">
                            <ImageIcon size={32} color={theme.mutedForeground} strokeWidth={2} />
                          </View>
                          <Text className="text-[11px] font-bold text-muted-foreground mt-2 text-center">Gallery</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Animated.View entering={FadeIn} className="aspect-[3/4] rounded-[40px] overflow-hidden relative shadow-2xl bg-neutral-900">
                    <Image
                      source={{ uri: selectedImage }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      onPress={() => setSelectedImage(null)}
                      activeOpacity={0.8}
                      className="absolute top-4 right-4 h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-xl border border-white/10">
                      <X size={22} color="#fff" />
                    </TouchableOpacity>
                    <View className="absolute bottom-4 left-4 right-4 flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => pickImage(true)}
                        activeOpacity={0.8}
                        className="flex-1 h-11 rounded-full bg-white/20 backdrop-blur-xl items-center justify-center flex-row gap-2 border border-white/10">
                        <Camera size={16} color="#fff" />
                        <Text className="text-white font-bold text-sm">Retake</Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                )}

            <Animated.View entering={FadeInDown.delay(100).springify()} className="mt-5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="h-6 w-6 rounded-lg bg-secondary items-center justify-center">
                  <Text className="text-xs">💬</Text>
                </View>
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Caption</Text>
              </View>
              <TextInput
                className="bg-card border border-border/50 rounded-2xl px-4 py-4 text-foreground text-base"
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption..."
                placeholderTextColor={theme.mutedForeground}
                maxLength={100}
                multiline
              />
              <Text className="text-[10px] text-muted-foreground mt-2 ml-2">{caption.length}/100</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).springify()} className="mt-5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="h-6 w-6 rounded-lg bg-primary/15 items-center justify-center">
                  <User size={12} color={theme.primary} />
                </View>
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Send to</Text>
              </View>
              {isLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : friendsError ? (
                <View className="bg-card border border-destructive/20 rounded-2xl p-6 items-center">
                  <View className="h-14 w-14 rounded-2xl bg-destructive/10 items-center justify-center mb-3">
                    <X size={24} color={theme.destructive} />
                  </View>
                  <Text className="text-foreground font-bold text-base text-center">
                    Failed to load friends
                  </Text>
                  <Text className="text-muted-foreground text-center mt-1.5 text-sm">
                    {(friendsError as Error)?.message || 'Check your connection'}
                  </Text>
                </View>
              ) : friends.length === 0 ? (
                <View className="bg-card border border-border/50 rounded-2xl p-6 items-center">
                  <View className="h-14 w-14 rounded-2xl bg-secondary items-center justify-center mb-3">
                    <Users size={24} color={theme.mutedForeground} />
                  </View>
                  <Text className="text-foreground font-bold text-base text-center">
                    No friends yet
                  </Text>
                  <Text className="text-muted-foreground text-center mt-1.5 text-sm">
                    Add friends to send tapins!
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/users')}
                    activeOpacity={0.8}
                    className="mt-4">
                    <LinearGradient
                      colors={['#7c3aed', '#8b5cf6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="px-6 py-3 rounded-xl">
                      <Text className="text-white font-bold">Find Friends</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="gap-2.5">
                  {friends.map((friend: any, index: number) => (
                    <Animated.View key={friend.id} entering={FadeInUp.delay(index * 40).springify()}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedFriend(friend.id);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.8}
                        className={`flex-row items-center p-3.5 rounded-2xl border ${
                          selectedFriend === friend.id
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-card border-border/40'
                        }`}>
                        <View className={`h-12 w-12 rounded-xl overflow-hidden items-center justify-center ${
                          selectedFriend === friend.id ? 'bg-primary/20' : 'bg-secondary'
                        }`}>
                          {friend.avatar_url ? (
                            <Image
                              source={{ uri: friend.avatar_url }}
                              style={{ width: 48, height: 48 }}
                              contentFit="cover"
                            />
                          ) : (
                            <User size={20} color={selectedFriend === friend.id ? theme.primary : theme.mutedForeground} />
                          )}
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className={`text-base font-bold ${selectedFriend === friend.id ? 'text-primary' : 'text-foreground'}`}>
                            {friend.full_name || friend.username || 'Friend'}
                          </Text>
                          {friend.username && (
                            <Text className="text-xs text-muted-foreground mt-0.5">@{friend.username}</Text>
                          )}
                        </View>
                        {selectedFriend === friend.id ? (
                          <View className="h-8 w-8 rounded-xl bg-primary items-center justify-center">
                            <Check size={16} color="#fff" strokeWidth={3} />
                          </View>
                        ) : (
                          <View className="h-8 w-8 rounded-xl bg-secondary/60 border border-border/50" />
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </ScrollView>

        <Animated.View entering={FadeInUp.springify()} className="px-5 pb-8 pt-4 bg-background">
            <TouchableOpacity
              onPress={uploadAndSend}
              disabled={!selectedImage || !selectedFriend || uploading}
              activeOpacity={0.9}>
              <LinearGradient
                colors={
                  !selectedImage || !selectedFriend
                    ? [theme.muted, theme.muted]
                    : ['#fcd34d', '#f59e0b', '#d97706']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className={`flex-row items-center justify-center h-[56px] rounded-full gap-2.5 ${
                  selectedImage && selectedFriend ? 'shadow-lg shadow-amber-500/40' : ''
                }`}>
                {uploading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Send 
                      size={20} 
                      color={!selectedImage || !selectedFriend ? theme.mutedForeground : '#000'} 
                      strokeWidth={2.5} 
                    />
                    <Text
                      className={`text-base font-bold ${
                        !selectedImage || !selectedFriend ? 'text-muted-foreground' : 'text-black'
                      }`}>
                      Send
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
      </SafeAreaView>
    );
}
