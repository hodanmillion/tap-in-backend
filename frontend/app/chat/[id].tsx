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
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import { apiRequest } from '@/lib/api';

const CHAT_RADIUS_METERS = 100;
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || 'l1WfAFgqA5WupWoMaCaWKB12G54J6LtZ';

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function formatDateSeparator(date: Date) {
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ChatScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const { id: initialId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { drafts, setDraft, clearDraft } = useChat();
  const [id, setId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isResolvingId, setIsResolvingId] = useState(true);

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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { location } = useLocation(user?.id);

  const headerLeftComponent = useMemo(
    () => (
      <TouchableOpacity onPress={() => router.back()} className="mr-4">
        <ChevronLeft size={28} color={theme.primary} />
      </TouchableOpacity>
    ),
    [router, theme.primary]
  );

  const resolveRoomId = useCallback(async () => {
    if (!user) return;
    setIsResolvingId(true);

    if (typeof initialId === 'string' && initialId.startsWith('private_')) {
      const friendId = initialId.replace('private_', '');
      try {
        const data = await apiRequest('/rooms/private', {
          method: 'POST',
          body: JSON.stringify({ user1_id: user.id, user2_id: friendId }),
        });
        if (data.room_id) {
          setId(data.room_id);
        }
      } catch (error) {
        console.error('Error resolving private room:', error);
      }
    } else {
      setId(initialId as string);
    }
    setIsResolvingId(false);
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
        await apiRequest(`/rooms/${id}/join`, {
          method: 'POST',
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

  const fetchMessages = useCallback(async (cursor?: string) => {
    if (!id) return;
    try {
      const url = cursor
        ? `/messages/${id}?limit=50&cursor=${encodeURIComponent(cursor)}`
        : `/messages/${id}?limit=50`;
      const data = await apiRequest(url);
      if (data) {
        if (cursor) {
          setMessages((prev) => [...prev, ...data.messages]);
        } else {
          setMessages(data.messages || []);
        }
        setNextCursor(data.nextCursor);
        setHasMoreMessages(data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [id]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    await fetchMessages(nextCursor);
    setLoadingMore(false);
  }, [hasMoreMessages, loadingMore, nextCursor, fetchMessages]);

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
          // Check if we already have this message (optimistic or otherwise)
          setMessages((current) => {
            if (current.some((m) => m.id === payload.new.id)) return current;

            // Try to find if there's an optimistic version of this message to replace
            // We check for matching content, sender, and recent timestamp
            const isMyMessage = payload.new.sender_id === user?.id;
            const optimisticIndex = isMyMessage
              ? current.findIndex((m) => m.isOptimistic && m.content === payload.new.content)
              : -1;

            if (optimisticIndex > -1) {
              const updated = [...current];
              updated[optimisticIndex] = {
                ...payload.new,
                sender: {
                  id: user?.id,
                  username: user?.user_metadata?.username,
                  full_name: user?.user_metadata?.full_name,
                  avatar_url: user?.user_metadata?.avatar_url,
                },
              };
              return updated;
            }

            // If not found, fetch profile and add (actually we should fetch profile for non-mine messages)
            return current;
          });

          // If it's not my message or not found optimistically, we need the profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          setMessages((current) => {
            if (current.some((m) => m.id === payload.new.id)) {
              // Just update the profile if it was already there
              return current.map((m) => (m.id === payload.new.id ? { ...m, sender: profile } : m));
            }
            const newMessage = { ...payload.new, sender: profile };

            // Check again for optimistic match to replace
            const isMyMessage = payload.new.sender_id === user?.id;
            const optimisticIndex = isMyMessage
              ? current.findIndex((m) => m.isOptimistic && m.content === payload.new.content)
              : -1;

            if (optimisticIndex > -1) {
              const updated = [...current];
              updated[optimisticIndex] = newMessage;
              return updated;
            }

            return [newMessage, ...current];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id, fetchRoomAndUser, fetchMessages]);

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
      const radius = room.radius || CHAT_RADIUS_METERS;
      setIsOutOfRange(distance > radius);
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
        Alert.alert(
          'Out of Range',
          `You need to be within ${room?.radius || CHAT_RADIUS_METERS}m of the room to send messages.`
        );
        return;
      }
      const finalContent = content || newMessage;
      if (!finalContent.trim()) return;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to send messages.');
        return;
      }
      if (!id) {
        if (isResolvingId) {
          // If still resolving, we wait a bit or show an alert
          Alert.alert('Please Wait', 'Connecting to chat room...');
        } else {
          Alert.alert('Error', 'Room ID not resolved. Please try again.');
        }
        return;
      }

      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1. Create optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        room_id: id,
        sender_id: user.id,
        content: finalContent,
        type: type,
        created_at: new Date().toISOString(),
        isOptimistic: true,
        sender: {
          id: user.id,
          username: user.user_metadata?.username,
          full_name: user.user_metadata?.full_name,
          avatar_url: user.user_metadata?.avatar_url,
        },
      };

      // 2. Add to local state immediately
      setMessages((current) => [optimisticMessage, ...current]);

      // 3. Clear input and draft immediately for responsiveness
      if (type === 'text') {
        setNewMessage('');
        clearDraft(id);
      }

      try {
        const data = await apiRequest('/messages', {
          method: 'POST',
          body: JSON.stringify({
            room_id: id,
            sender_id: user.id,
            content: finalContent,
            type: type,
          }),
        });

        if (!data || data.error) {
          throw new Error(data?.message || data?.error || 'Failed to send');
        }
      } catch (error: any) {
        console.error('Error sending message:', error);

        // 4. On error, remove optimistic message and restore input
        setMessages((current) => current.filter((m) => m.id !== tempId));

        if (type === 'text') {
          setNewMessage(finalContent);
          setDraft(id, finalContent);
        }

        if (error.message?.includes('Out of range') || error.error === 'Out of range') {
          Alert.alert('Out of Range', error.message || 'You are too far from this location.');
        } else if (error.code === '23503') {
          setRoomNotFound(true);
          Alert.alert('Error', 'This room no longer exists.');
        } else {
          Alert.alert('Error', error.message || 'Failed to send message. Please check your connection.');
        }
      }
    },
    [id, user, newMessage, roomNotFound, isExpired, isOutOfRange, room?.type, isResolvingId]
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
      headerStyle: { backgroundColor: theme.background },
      headerTitleStyle: { color: theme.foreground, fontSize: 17, fontWeight: '600' as any },
      headerShadowVisible: false,
    }),
    [headerLeftComponent, theme.background, theme.foreground]
  );

  const headerOptions = useMemo(
    () => ({
      title: room?.name || 'Chat',
      headerShown: true,
      headerLeft: () => headerLeftComponent,
      headerStyle: { backgroundColor: theme.background },
      headerTitleStyle: { color: theme.foreground, fontSize: 17, fontWeight: '600' as any },
      headerShadowVisible: false,
    }),
    [room?.name, headerLeftComponent, theme.background, theme.foreground]
  );

  const messagesWithSeparators = useMemo(() => {
    if (messages.length === 0) return [];
    const result: any[] = [];
    for (let i = 0; i < messages.length; i++) {
      const current = messages[i];
      const next = messages[i + 1];
      result.push(current);

      const currentDate = new Date(current.created_at);
      const nextDate = next ? new Date(next.created_at) : null;

      if (!nextDate || !isSameDay(currentDate, nextDate)) {
        result.push({
          id: `sep-${current.id}`,
          type: 'separator',
          date: currentDate,
        });
      }
    }
    return result;
  }, [messages]);

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === 'separator') {
        return (
          <View className="mb-6 mt-2 items-center justify-center">
            <View className="bg-secondary/50 px-4 py-1.5 rounded-full border border-border/50">
              <Text className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {formatDateSeparator(item.date)}
              </Text>
            </View>
          </View>
        );
      }

      const isMine = item.sender_id === user?.id;
      return (
        <View className={`mb-4 flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
          <View
            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
              isMine ? 'rounded-br-none bg-primary' : 'rounded-bl-none bg-secondary/80'
            }`}>
            {!isMine && (
              <Text className="mb-1 text-[11px] font-black text-primary uppercase tracking-wider">
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
                className={`text-[16px] font-medium leading-5 ${
                  isMine ? 'text-primary-foreground' : 'text-foreground'
                }`}>
                {item.content}
              </Text>
            )}
            <View className="mt-1 flex-row items-center justify-end">
              <Text
                className={`text-[9px] font-bold opacity-60 ${
                  isMine ? 'text-primary-foreground/80' : 'text-muted-foreground'
                }`}>
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [user?.id, theme.primary]
  );

  if (initialLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={defaultHeaderOptions} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={defaultHeaderOptions} />
        <ActivityIndicator size="large" color={theme.primary} />
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
            <FlashList
              data={messagesWithSeparators}
              inverted
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              estimatedItemSize={80}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                ) : null
              }
            />

          {(isOutOfRange || isExpired || roomNotFound) && room?.type !== 'private' ? (
            <View className="border-t border-border bg-card px-4 py-3 pb-10">
              <View className="flex-row items-center rounded-2xl bg-secondary/50 px-4 py-3 border border-border/50">
                <Lock size={18} color={theme.mutedForeground} className="mr-3" />
                <Text className="flex-1 text-[14px] font-bold text-muted-foreground tracking-tight">
                  {roomNotFound
                    ? 'This chat room is no longer active.'
                    : isExpired
                      ? 'This chat has expired.'
                      : `Read only - You've left the ${room?.radius || 20}m area.`}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center border-t border-border bg-card px-4 py-3 pb-10">
              <TouchableOpacity onPress={() => setGifModalVisible(true)} className="mr-3 p-1">
                <Smile size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={takePicture} className="mr-3 p-1" disabled={uploading}>
                <Camera size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} className="mr-3 p-1" disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <ImageIcon size={24} color={theme.mutedForeground} />
                )}
              </TouchableOpacity>
              <View className="mr-3 flex-1 rounded-2xl bg-secondary/50 px-4 py-2 border border-border/50">
                <TextInput
                  placeholder="Type a message..."
                  placeholderTextColor={theme.mutedForeground}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  className="max-h-24 text-[16px] text-foreground font-medium"
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={() => sendMessage()}
                className={`h-11 w-11 items-center justify-center rounded-full shadow-sm ${
                  newMessage.trim() ? 'bg-primary' : 'bg-secondary/80'
                }`}
                disabled={!newMessage.trim()}>
                <Send
                  size={20}
                  color={newMessage.trim() ? theme.primaryForeground : theme.mutedForeground}
                />
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
        <View className="flex-1 bg-background p-4">
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-2xl font-black text-foreground uppercase tracking-tighter">
              GIF Search
            </Text>
            <TouchableOpacity
              onPress={() => setGifModalVisible(false)}
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <X size={24} color={theme.foreground} />
            </TouchableOpacity>
          </View>
          <View className="mb-6 flex-row items-center rounded-2xl bg-secondary/50 px-4 py-3 border border-border/50">
            <Search size={20} color={theme.mutedForeground} />
            <TextInput
              placeholder="Search Giphy..."
              placeholderTextColor={theme.mutedForeground}
              value={gifSearch}
              onChangeText={setGifSearch}
              className="ml-2 flex-1 text-foreground font-bold"
              autoFocus
            />
            {gifSearch.length > 0 && (
              <TouchableOpacity onPress={() => setGifSearch('')}>
                <X size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          {gifLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                paddingBottom: 40,
              }}>
              {gifError ? (
                <View className="flex-1 items-center justify-center px-10 pt-20">
                  <Text className="mb-2 text-center font-bold text-red-500 uppercase tracking-widest">
                    API Error
                  </Text>
                  <Text className="text-center text-sm font-medium text-muted-foreground px-4">
                    Please ensure EXPO_PUBLIC_GIPHY_API_KEY is configured in your settings.
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
                    activeOpacity={0.8}
                    className="mb-3 w-[48%] overflow-hidden rounded-2xl border border-border/40">
                    <Image
                      source={{
                        uri: gif.images.preview_gif?.url || gif.images.fixed_height_small.url,
                      }}
                      className="h-32 w-full bg-secondary/30"
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                ))
              ) : (
                <View className="flex-1 items-center justify-center pt-20">
                  <Text className="text-base font-bold text-muted-foreground/60 uppercase tracking-widest">
                    No results found
                  </Text>
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
            className="absolute right-6 top-16 z-10 h-12 w-12 items-center justify-center rounded-full bg-zinc-900/80 border border-zinc-800"
            onPress={() => setSelectedImage(null)}>
            <X size={28} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} className="h-full w-full" contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
