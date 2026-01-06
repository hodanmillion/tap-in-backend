import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Image as ImageIcon, Mic, Lock, Smile, X, Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useLocation } from '@/hooks/useLocation';

const CHAT_RADIUS_METERS = 20;
const GIPHY_API_KEY = 'dc6zaTOxFJmzC'; // Public beta key

export default function ChatScreen() {
  const { id: initialId } = useLocalSearchParams();
  const [id, setId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  const { location } = useLocation(user?.id);

  useEffect(() => {
    resolveRoomId();
  }, [initialId]);

  async function resolveRoomId() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (typeof initialId === 'string' && initialId.startsWith('private_')) {
      const friendId = initialId.replace('private_', '');
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/rooms/private`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user1_id: user?.id, user2_id: friendId }),
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
  }

  useEffect(() => {
    if (!id) return;

    fetchRoomAndUser();
    fetchMessages();

    const channel = supabase
      .channel(`room:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` },
        (payload) => {
          setMessages((current) => [payload.new, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (room && location && room.type !== 'private') {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        room.latitude,
        room.longitude
      );
      setIsOutOfRange(distance > CHAT_RADIUS_METERS);
      
      if (room.expires_at) {
        const now = new Date();
        const expires = new Date(room.expires_at);
        setIsExpired(now > expires);
      }
    }
  }, [room, location]);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // Radius of the earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function fetchRoomAndUser() {
    if (!id) return;
    
    const { data } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data?.type === 'private') {
      const { data: participants } = await supabase
        .from('room_participants')
        .select('profiles(full_name, username)')
        .eq('room_id', id)
        .neq('user_id', user?.id)
        .single();
      
      const otherUser = (participants as any)?.profiles;
      setRoom({ ...data, name: otherUser?.full_name || `@${otherUser?.username}` || 'Private Chat' });
    } else {
      setRoom(data);
    }
    setLoading(false);
  }

  async function fetchMessages() {
    if (!id) return;
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name, avatar_url)')
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setMessages(data);
  }

  async function sendMessage(content?: string, type: 'text' | 'image' | 'gif' = 'text') {
    if (isOutOfRange && room?.type !== 'private') return;
    
    const finalContent = content || newMessage;
    if (!finalContent.trim() || !user || !id) return;

    const message = {
      room_id: id,
      sender_id: user.id,
      content: finalContent,
      type: type,
    };

    if (type === 'text') setNewMessage('');
    
    const { error } = await supabase.from('messages').insert(message);
    if (error) console.error('Error sending message:', error);
  }

  async function pickImage() {
    if (isOutOfRange && room?.type !== 'private') return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  }

  async function uploadImage(uri: string) {
    setUploading(true);
    try {
      const fileName = `${id}/${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'image.jpg',
        type: 'image/jpeg',
      } as any);

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, formData);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      await sendMessage(publicUrl, 'image');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }

  async function searchGifs() {
    if (!gifSearch.trim()) return;
    setGifLoading(true);
    try {
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${gifSearch}&limit=20`);
      const data = await response.json();
      setGifs(data.data);
    } catch (error) {
      console.error('GIF search failed:', error);
    } finally {
      setGifLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (gifSearch) searchGifs();
    }, 500);
    return () => clearTimeout(timer);
  }, [gifSearch]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-950">
        <Stack.Screen options={{ title: 'Chat', headerShown: true }} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: room?.name || 'Chat', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isMine = item.sender_id === user?.id;
            return (
              <View
                className={`mb-4 flex-row ${
                  isMine ? 'justify-end' : 'justify-start'
                }`}
              >
                <View
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMine
                      ? 'bg-blue-600 rounded-br-none'
                      : 'bg-zinc-800 rounded-bl-none'
                  }`}
                >
                  {!isMine && (
                    <Text className="mb-1 text-xs font-bold text-zinc-400">
                      {item.profiles?.full_name || 'User'}
                    </Text>
                  )}
                  
                  {item.type === 'image' || item.type === 'gif' ? (
                    <View className="overflow-hidden rounded-lg">
                      <Image
                        source={{ uri: item.content }}
                        className="h-48 w-64"
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    <Text
                      className={`text-[16px] leading-5 ${
                        isMine ? 'text-white' : 'text-zinc-100'
                      }`}
                    >
                      {item.content}
                    </Text>
                  )}
                  
                  <View className="mt-1 flex-row items-center justify-end">
                    <Text
                      className={`text-[10px] opacity-60 ${
                        isMine ? 'text-blue-100' : 'text-zinc-400'
                      }`}
                    >
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

        {(isOutOfRange || isExpired) && room?.type !== 'private' ? (
          <View className="flex-row items-center border-t border-zinc-800 bg-red-950/20 p-4 pb-8">
            <Lock size={20} color="#ef4444" className="mr-3" />
            <Text className="flex-1 text-sm font-semibold text-red-400">
              {isExpired 
                ? 'This chat has expired after 48 hours.'
                : "You've left the 20m area. Move back to chat."}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center border-t border-zinc-900 bg-zinc-950 px-4 py-3 pb-10">
            <TouchableOpacity onPress={() => setGifModalVisible(true)} className="mr-3 p-1">
              <Smile size={24} color="#a1a1aa" />
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
              className={`h-10 w-10 items-center justify-center rounded-full ${
                newMessage.trim() ? 'bg-blue-600' : 'bg-zinc-800'
              }`}
              disabled={!newMessage.trim()}
            >
              <Send size={20} color={newMessage.trim() ? "white" : "#71717a"} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={gifModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGifModalVisible(false)}
      >
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
          </View>

          {gifLoading ? (
            <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
          ) : (
            <ScrollView className="flex-1" contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {gifs.map((gif) => (
                <TouchableOpacity
                  key={gif.id}
                  onPress={() => {
                    sendMessage(gif.images.fixed_height.url, 'gif');
                    setGifModalVisible(false);
                    setGifSearch('');
                  }}
                  className="mb-2 w-[48%]"
                >
                  <Image
                    source={{ uri: gif.images.fixed_height.url }}
                    className="h-32 w-full rounded-lg bg-zinc-900"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
