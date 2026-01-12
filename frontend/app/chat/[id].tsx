import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
    ActivityIndicator,
    Modal,
    ScrollView,
    Pressable,
    FlatList,
  } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Send,
  Image as ImageIcon,
  Lock,
  Smile,
  X,
  Search,
  ChevronLeft,
  Camera,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useLocation } from '@/hooks/useLocation';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';

const CHAT_RADIUS_METERS = 100;
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || 'l1WfAFgqA5WupWoMaCaWKB12G54J6LtZ';

export default function ChatScreen() {
  const { id: initialId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { drafts, setDraft, clearDraft } = useChat();
  const [id, setId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Restore draft on mount
  useEffect(() => {
    if (id && drafts[id]) {
      setNewMessage(drafts[id]);
    }
  }, [id]);

  // Save draft on change
  const handleMessageChange = (text: string) => {
    setNewMessage(text);
    if (id) {
      setDraft(id, text);
    }
  };

  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  const { location } = useLocation(user?.id);

  const headerLeftComponent = useMemo(
    () => (
      <TouchableOpacity onPress={() => router.back()} className="mr-4">
        <ChevronLeft size={28} color="#3b82f6" />
      </TouchableOpacity>
    ),
    [router]
  );

  const resolveRoomId = useCallback(async () => {
    if (!user) return;

    if (typeof initialId === 'string' && initialId.startsWith('private_')) {
      const friendId = initialId.replace('private_', '');
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/rooms/private`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user1_id: user.id, user2_id: friendId }),
        });
        const data = await response.json();
        if (data.room_id) {
          setId(data.room_id);
        }
      } catch (error) {
        console.error('Error resolving private room:', error);
      }
    } else {
      setId(initialId as string);
    }
  }, [initialId, user]);

  useEffect(() => {
    if (user) {
      resolveRoomId();
    }
    const timer = setTimeout(() => setInitialLoading(false), 50);
    return () => clearTimeout(timer);
  }, [resolveRoomId, user]);

    const fetchRoomAndUser = useCallback(async () => {
      if (!id || !user?.id) return;
      const { data } = await supabase.from('chat_rooms').select('*').eq('id', id).single();
      if (!data) {
        setRoomNotFound(true);
        setLoading(false);
        return;
      }

      // Join the room if it's an auto-generated one to make it persistent in "Chats"
      if (data.type === 'auto_generated') {
        try {
          await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/rooms/${id}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          });
        } catch (error) {
          console.error('Error joining room:', error);
        }
      }

      if (data.type === 'private') {

      const { data: participants } = await supabase
        .from('room_participants')
        .select('profiles(full_name, username)')
        .eq('room_id', id)
        .neq('user_id', user?.id)
        .single();
      const otherUser = (participants as any)?.profiles;
      setRoom({
        ...data,
        name: otherUser?.full_name || `@${otherUser?.username}` || 'Private Chat',
      });
    } else {
      let updatedRoom = { ...data };
      if (data.type === 'auto_generated') {
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: data.latitude,
            longitude: data.longitude,
          });
          if (reverseGeocode && reverseGeocode.length > 0) {
            const loc = reverseGeocode[0];
            const address = loc.street || loc.name || loc.city || 'Nearby Chat';
            if (address) updatedRoom.name = address;
          }
        } catch (e) {
          console.log('Header geocode failed', e);
        }
      }
      setRoom(updatedRoom);
    }
    setLoading(false);
  }, [id, user?.id]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/messages/${id}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      if (data) setMessages([...data].reverse());
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchRoomAndUser();
    fetchMessages();
    const channel = supabase
      .channel(`room:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` },
        async (payload) => {
          // Fetch the profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();
          
          const newMessage = {
            ...payload.new,
            sender: profile
          };
          setMessages((current) => [newMessage, ...current]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchRoomAndUser, fetchMessages]);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  useEffect(() => {
    if (room && location && room.type !== 'private') {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        room.latitude,
        room.longitude
      );
      setIsOutOfRange(distance > (room.radius || CHAT_RADIUS_METERS));
      if (room.expires_at) {
        const now = new Date();
        const expires = new Date(room.expires_at);
        setIsExpired(now > expires);
      }
    }
  }, [room, location]);

  useEffect(() => {
    if (id && drafts[id]) {
      setNewMessage(drafts[id]);
    }
  }, [id]);

  useEffect(() => {
    if (id && newMessage !== (drafts[id] || '')) {
      setDraft(id, newMessage);
    }
  }, [id, newMessage]);

  const sendMessage = useCallback(
    async (content?: string, type: 'text' | 'image' | 'gif' = 'text') => {
      if (roomNotFound || isExpired) {
        Alert.alert('Error', 'This room is no longer active.');
        return;
      }
      if (isOutOfRange && room?.type !== 'private') {
        Alert.alert('Out of Range', `You need to be within ${room?.radius || CHAT_RADIUS_METERS}m of the room to send messages.`);
        return;
      }
      const finalContent = content || newMessage;
      if (!finalContent.trim()) return;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to send messages.');
        return;
      }
      if (!id) {
        Alert.alert('Error', 'Room ID not resolved. Please try again.');
        return;
      }

      const message = { room_id: id, sender_id: user.id, content: finalContent, type: type };
      if (type === 'text') {
        setNewMessage('');
        clearDraft(id);
      }
      
      const { error } = await supabase.from('messages').insert(message);
      if (error) {
        console.error('Error sending message:', error);
        if (error.code === '23503') {
          setRoomNotFound(true);
          Alert.alert('Error', 'This room no longer exists.');
        } else {
          Alert.alert('Error', 'Failed to send message. Please check your connection.');
        }
      }
    },
    [id, user?.id, newMessage, roomNotFound, isExpired, isOutOfRange, room?.type]
  );

  const pickImage = useCallback(async () => {
    if (isOutOfRange && room?.type !== 'private') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  }, [isOutOfRange, room?.type]);

  const takePicture = useCallback(async () => {
    if (isOutOfRange && room?.type !== 'private') return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5 });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  }, [isOutOfRange, room?.type]);

  const uploadImage = useCallback(
    async (uri: string) => {
      setUploading(true);
      try {
        const fileName = `${id}/${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append('file', { uri, name: 'image.jpg', type: 'image/jpeg' } as any);
        const { error } = await supabase.storage.from('chat-images').upload(fileName, formData);
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('chat-images').getPublicUrl(fileName);
        await sendMessage(publicUrl, 'image');
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setUploading(false);
      }
    },
    [id, sendMessage]
  );

  const fetchTrendingGifs = useCallback(async () => {
    setGifLoading(true);
    setGifError(null);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`
      );
      const data = await response.json();
      if (data.meta?.status === 403) {
        setGifError('GIPHY API key is invalid or banned.');
        setGifs([]);
      } else if (data.data) {
        setGifs(data.data);
      }
    } catch (error) {
      console.error('Trending GIFs fetch failed:', error);
      setGifError('Failed to fetch GIFs.');
    } finally {
      setGifLoading(false);
    }
  }, []);

  const searchGifs = useCallback(async () => {
    if (!gifSearch.trim()) {
      fetchTrendingGifs();
      return;
    }
    setGifLoading(true);
    setGifError(null);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${gifSearch}&limit=20`
      );
      const data = await response.json();
      if (data.meta?.status === 403) {
        setGifError('GIPHY API key is invalid or banned.');
        setGifs([]);
      } else if (data.data) {
        setGifs(data.data);
      }
    } catch (error) {
      console.error('GIF search failed:', error);
      setGifError('Failed to search GIFs.');
    } finally {
      setGifLoading(false);
    }
  }, [gifSearch, fetchTrendingGifs]);

  useEffect(() => {
    if (gifModalVisible && !gifSearch) {
      fetchTrendingGifs();
    }
  }, [gifModalVisible, gifSearch, fetchTrendingGifs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (gifSearch) {
        searchGifs();
      } else if (gifModalVisible) {
        fetchTrendingGifs();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [gifSearch, gifModalVisible, searchGifs, fetchTrendingGifs]);

  const defaultHeaderOptions = useMemo(
    () => ({
      title: 'Loading...',
      headerShown: true,
      headerLeft: () => headerLeftComponent,
      headerStyle: { backgroundColor: '#09090b' },
      headerTitleStyle: { color: '#ffffff', fontSize: 17, fontWeight: '600' as any },
      headerShadowVisible: false,
    }),
    [headerLeftComponent]
  );

  const headerOptions = useMemo(
    () => ({
      title: room?.name || 'Chat',
      headerShown: true,
      headerLeft: () => headerLeftComponent,
      headerStyle: { backgroundColor: '#09090b' },
      headerTitleStyle: { color: '#ffffff', fontSize: 17, fontWeight: '600' as any },
      headerShadowVisible: false,
    }),
    [room?.name, headerLeftComponent]
  );

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View className={`mb-4 flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
        <View
          className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMine ? 'rounded-br-none bg-blue-600' : 'rounded-bl-none bg-zinc-800'}`}>
          {!isMine && (
            <Text className="mb-1 text-xs font-bold text-zinc-400">
              {item.sender?.full_name || item.sender?.username || 'User'}
            </Text>
          )}
          {item.type === 'image' || item.type === 'gif' ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedImage(item.content)}
              className="overflow-hidden rounded-lg">
              <Image
                source={{ uri: item.content }}
                className="h-48 w-64"
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ) : (
            <Text
              className={`text-[16px] leading-5 ${isMine ? 'text-white' : 'text-zinc-100'}`}>
              {item.content}
            </Text>
          )}
          <View className="mt-1 flex-row items-center justify-end">
            <Text
              className={`text-[10px] opacity-60 ${isMine ? 'text-blue-100' : 'text-zinc-400'}`}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [user?.id]);

  if (initialLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <Stack.Screen options={defaultHeaderOptions} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        <Stack.Screen options={defaultHeaderOptions} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={headerOptions} />
      <SafeAreaView className="flex-1" edges={['bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
            <FlatList
              data={messages}
              inverted
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderMessage}
            />

          {(isOutOfRange || isExpired || roomNotFound) && room?.type !== 'private' ? (
            <View className="border-t border-zinc-900 bg-zinc-950 px-4 py-3 pb-10">
              <View className="flex-row items-center rounded-2xl bg-zinc-900/50 px-4 py-3 border border-zinc-800/50">
                <Lock size={18} color="#71717a" className="mr-3" />
                <Text className="flex-1 text-[14px] font-medium text-zinc-500">
                  {roomNotFound
                    ? 'This chat room is no longer active.'
                    : isExpired
                      ? 'This chat has expired.'
                      : `Read only - You've left the ${room?.radius || 20}m area.`}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center border-t border-zinc-900 bg-zinc-950 px-4 py-3 pb-10">
              <TouchableOpacity onPress={() => setGifModalVisible(true)} className="mr-3 p-1">
                <Smile size={24} color="#a1a1aa" />
              </TouchableOpacity>
              <TouchableOpacity onPress={takePicture} className="mr-3 p-1" disabled={uploading}>
                <Camera size={24} color="#a1a1aa" />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} className="mr-3 p-1" disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <ImageIcon size={24} color="#a1a1aa" />
                )}
              </TouchableOpacity>
              <View className="mr-3 flex-1 rounded-2xl bg-zinc-900 px-4 py-2">
                <TextInput
                  placeholder="Type a message..."
                  placeholderTextColor="#71717a"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  className="max-h-24 text-[16px] text-zinc-100"
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={() => sendMessage()}
                className={`h-10 w-10 items-center justify-center rounded-full ${newMessage.trim() ? 'bg-blue-600' : 'bg-zinc-800'}`}
                disabled={!newMessage.trim()}>
                <Send size={20} color={newMessage.trim() ? 'white' : '#71717a'} />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={gifModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGifModalVisible(false)}>
        <View className="flex-1 bg-zinc-950 p-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white">Search GIFs</Text>
            <TouchableOpacity onPress={() => setGifModalVisible(false)}>
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>
          <View className="mb-4 flex-row items-center rounded-xl bg-zinc-900 px-4 py-2">
            <Search size={20} color="#71717a" />
            <TextInput
              placeholder="Search Giphy..."
              placeholderTextColor="#71717a"
              value={gifSearch}
              onChangeText={setGifSearch}
              className="ml-2 flex-1 text-white"
              autoFocus
            />
            {gifSearch.length > 0 && (
              <TouchableOpacity onPress={() => setGifSearch('')}>
                <X size={18} color="#71717a" />
              </TouchableOpacity>
            )}
          </View>
          {gifLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                paddingBottom: 20,
              }}>
              {gifError ? (
                <View className="flex-1 items-center justify-center px-10 pt-20">
                  <Text className="mb-2 text-center font-medium text-red-400">{gifError}</Text>
                  <Text className="text-center text-sm text-zinc-500">
                    Please make sure EXPO_PUBLIC_GIPHY_API_KEY is set correctly in your .env file.
                  </Text>
                </View>
              ) : gifs.length > 0 ? (
                gifs.map((gif) => (
                  <TouchableOpacity
                    key={gif.id}
                    onPress={() => {
                      sendMessage(gif.images.fixed_height.url, 'gif');
                      setGifModalVisible(false);
                      setGifSearch('');
                    }}
                    className="mb-2 w-[48%]">
                    <Image
                      source={{
                        uri: gif.images.preview_gif?.url || gif.images.fixed_height_small.url,
                      }}
                      className="h-32 w-full rounded-lg bg-zinc-900"
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <View className="flex-1 items-center justify-center pt-20">
                  <Text className="text-zinc-500">No GIFs found</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/95"
          onPress={() => setSelectedImage(null)}>
          <TouchableOpacity
            className="absolute right-6 top-12 z-10 rounded-full bg-zinc-900/50 p-2"
            onPress={() => setSelectedImage(null)}>
            <X size={24} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} className="h-full w-full" contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
