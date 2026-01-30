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
  AppState,
  AppStateStatus,
  FlatList,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Send,
  Image as ImageIcon,
  Lock,
  Smile,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Camera,
  User,
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
import { useNotifications } from '@/context/NotificationContext';
import { generateUUID, formatDistance, formatRoomName, formatGeographicDistance } from '@/lib/utils';

const CHAT_RADIUS_METERS = 1000;
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || 'l1WfAFgqA5WupWoMaCaWKB12G54J6LtZ';
const REALTIME_BUFFER_MS = 100;
const PROFILE_FETCH_DEBOUNCE_MS = 100;

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: string;
  created_at: string;
  client_msg_id?: string | null;
  isOptimistic?: boolean;
  status?: 'sending' | 'sent' | 'failed';
  sender?: Profile | null;
};

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

function mergeMessages(
  current: Message[],
  incoming: Message[],
  senderCache: Map<string, Profile>
): { merged: Message[]; newSenderIds: string[] } {
  const byId = new Map<string, Message>();
  const byClientId = new Map<string, Message>();
  const newSenderIds: string[] = [];

  const normalizeKey = (key: string | number | undefined | null): string | null => 
    key != null ? String(key) : null;

  for (const msg of current) {
    const id = normalizeKey(msg.id);
    if (id) byId.set(id, msg);
    const clientId = normalizeKey(msg.client_msg_id);
    if (clientId) byClientId.set(clientId, msg);
  }

  for (const msg of incoming) {
    const id = normalizeKey(msg.id);
    const clientId = normalizeKey(msg.client_msg_id);
    const existingById = id ? byId.get(id) : null;
    const existingByClientId = clientId ? byClientId.get(clientId) : null;

    if (existingById) {
      const updated = {
        ...existingById,
        ...msg,
        sender: existingById.sender || msg.sender || senderCache.get(msg.sender_id) || null,
        isOptimistic: false,
        status: 'sent' as const,
      };
      if (id) byId.set(id, updated);
      if (clientId) byClientId.set(clientId, updated);
    } else if (existingByClientId && existingByClientId.isOptimistic) {
      const oldId = normalizeKey(existingByClientId.id);
      if (oldId) byId.delete(oldId);
      const updated = {
        ...msg,
        sender: existingByClientId.sender || msg.sender || senderCache.get(msg.sender_id) || null,
        isOptimistic: false,
        status: 'sent' as const,
      };
      if (id) byId.set(id, updated);
      if (clientId) byClientId.set(clientId, updated);
    } else if (!existingByClientId) {
      const cachedSender = senderCache.get(msg.sender_id);
      if (!cachedSender && !newSenderIds.includes(msg.sender_id)) {
        newSenderIds.push(msg.sender_id);
      }
      const newMsg = {
        ...msg,
        sender: msg.sender || cachedSender || null,
      };
      if (id) byId.set(id, newMsg);
      if (clientId) byClientId.set(clientId, newMsg);
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return String(b.id).localeCompare(String(a.id));
  });

  return { merged, newSenderIds };
}

export default function ChatScreen() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];
  const { id: initialId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { drafts, setDraft, clearDraft } = useChat();
  const { setActiveChatRoomId } = useNotifications();
  const [id, setId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isResolvingId, setIsResolvingId] = useState(true);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const senderCacheRef = useRef<Map<string, Profile>>(new Map());
  const pendingSenderIdsRef = useRef<Set<string>>(new Set());
  const profileFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeBufferRef = useRef<any[]>([]);
  const realtimeFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenCreatedAtRef = useRef<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const listRef = useRef<any>(null);

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
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);

    const { location, locationRef } = useLocation(user?.id);

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({

    queryKey: ['chatMessages', id],
    queryFn: async () => {
      if (!id) return { messages: [], nextCursor: null, hasMore: false };
      const data = await apiRequest(`/messages/${id}?limit=50`);
      if (data && data.messages && data.messages.length > 0) {
        lastSeenCreatedAtRef.current = data.messages[0].created_at;
      }
      return data || { messages: [], nextCursor: null, hasMore: false };
    },
    enabled: !!id,
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  });

  const messages = messagesData?.messages || [];

  useEffect(() => {
    if (messagesData) {
      setNextCursor(messagesData.nextCursor);
      setHasMoreMessages(messagesData.hasMore);
    }
  }, [messagesData]);

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

    try {
      if (typeof initialId === 'string' && initialId.startsWith('private_')) {
        const friendId = initialId.replace('private_', '');
        const data = await apiRequest('/rooms/private', {
          method: 'POST',
          body: JSON.stringify({ user1_id: user.id, user2_id: friendId }),
        });
        if (data && data.room_id) {
          setId(data.room_id);
        } else {
          setResolutionError('Could not create private room');
        }
      } else if (initialId) {
        setId(initialId as string);
      } else {
        setResolutionError('No chat ID provided');
      }
    } catch (error: any) {
      console.error('Error resolving private room:', error);
      setResolutionError(error.message || 'Failed to connect to chat');
    } finally {
      setIsResolvingId(false);
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
          .select('profiles(id, full_name, username)')
          .eq('room_id', id)
          .neq('user_id', user?.id)
          .single();
        const otherUser = (participants as any)?.profiles;
        setRoom({
          ...data,
          name: otherUser?.full_name || `@${otherUser?.username}` || 'Private Chat',
          otherUserId: otherUser?.id,
        });
        } else {
            let updatedRoom = { ...data };
            // If it's an auto-generated room OR the name is generic, try to get a better address
            const normalizedName = (data.name || '').trim().toLowerCase();
            const isGenericName = !data.name || 
              normalizedName === 'nearby chat' || 
              normalizedName === 'general room' || 
              normalizedName === 'nearby zone' || 
              normalizedName === 'chat zone' ||
              normalizedName.includes('chat zone') || 
              normalizedName.includes('nearby zone');

            if (data.type === 'auto_generated' || isGenericName) {
              try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                  latitude: data.latitude,
                  longitude: data.longitude,
                });
                if (reverseGeocode && reverseGeocode.length > 0) {
                  const loc = reverseGeocode[0];
                  const street = loc.street || loc.name;
                  const streetNumber = loc.streetNumber || '';
                  const city = loc.city || '';
                  const district = loc.district || '';
                  
                  let address = '';
                  if (street && street !== 'Unnamed Road') {
                    address = streetNumber ? `${streetNumber} ${street}` : street;
                  } else if (district) {
                    address = `${district}, ${city}`;
                  } else if (city) {
                    address = city;
                  }
                  
                  if (address && address !== 'Unnamed Road' && address.toLowerCase() !== 'general room') {
                    updatedRoom.name = address;
                  }
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
          queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
            if (!oldData) return data;
            return {
              ...data,
              messages: [...(oldData.messages || []), ...data.messages],
            };
          });
        }
        setNextCursor(data.nextCursor);
        setHasMoreMessages(data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [id, queryClient]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    await fetchMessages(nextCursor);
    setLoadingMore(false);
  }, [hasMoreMessages, loadingMore, nextCursor, fetchMessages]);

  const fetchMissingProfiles = useCallback(async () => {
    const idsToFetch = Array.from(pendingSenderIdsRef.current);
    if (idsToFetch.length === 0) return;
    
    pendingSenderIdsRef.current.clear();
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', idsToFetch);
    
    if (!profiles) return;
    
    profiles.forEach((p) => {
      senderCacheRef.current.set(p.id, p);
    });
    
    queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        messages: oldData.messages.map((m: Message) => {
          if (!m.sender && senderCacheRef.current.has(m.sender_id)) {
            return { ...m, sender: senderCacheRef.current.get(m.sender_id) };
          }
          return m;
        }),
      };
    });
  }, [id, queryClient]);

  const scheduleFetchProfiles = useCallback((senderIds: string[]) => {
    senderIds.forEach((id) => {
      if (!senderCacheRef.current.has(id)) {
        pendingSenderIdsRef.current.add(id);
      }
    });
    
    if (profileFetchTimerRef.current) {
      clearTimeout(profileFetchTimerRef.current);
    }
    profileFetchTimerRef.current = setTimeout(fetchMissingProfiles, PROFILE_FETCH_DEBOUNCE_MS);
  }, [fetchMissingProfiles]);

  const fetchMessagesSince = useCallback(async (since: string) => {
    if (!id) return;
    try {
      const url = `/messages/${id}?limit=50&since=${encodeURIComponent(since)}`;
      const data = await apiRequest(url);
      if (data && data.messages && data.messages.length > 0) {
        const newMessages = data.messages as Message[];
        
        queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
          if (!oldData) return { messages: newMessages, nextCursor: null, hasMore: false };
          const { merged, newSenderIds } = mergeMessages(oldData.messages || [], newMessages, senderCacheRef.current);
          if (newSenderIds.length > 0) {
            setTimeout(() => scheduleFetchProfiles(newSenderIds), 0);
          }
          return { ...oldData, messages: merged };
        });
        
        lastSeenCreatedAtRef.current = newMessages[0].created_at;
      }
    } catch (error) {
      console.error('Error fetching messages since:', error);
    }
  }, [id, queryClient, scheduleFetchProfiles]);

  const processRealtimeBuffer = useCallback(() => {
    const buffer = realtimeBufferRef.current;
    if (buffer.length === 0) return;
    
    realtimeBufferRef.current = [];
    const incoming = buffer
      .map((payload) => payload.new as Message)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
      if (!oldData) return { messages: incoming.reverse(), nextCursor: null, hasMore: false };
      const { merged, newSenderIds } = mergeMessages(oldData.messages || [], incoming, senderCacheRef.current);
      if (newSenderIds.length > 0) {
        setTimeout(() => scheduleFetchProfiles(newSenderIds), 0);
      }
      return { ...oldData, messages: merged };
    });
    
    if (incoming.length > 0) {
      const latestCreatedAt = incoming[incoming.length - 1].created_at;
      if (!lastSeenCreatedAtRef.current || new Date(latestCreatedAt) > new Date(lastSeenCreatedAtRef.current)) {
        lastSeenCreatedAtRef.current = latestCreatedAt;
      }
    }
  }, [id, queryClient, scheduleFetchProfiles]);

  useEffect(() => {
    if (!id) return;
    fetchRoomAndUser();
    
    if (user) {
      senderCacheRef.current.set(user.id, {
        id: user.id,
        username: user.user_metadata?.username || null,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
      });
    }
    
    const channel = supabase
      .channel(`room:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}` },
        (payload) => {
          realtimeBufferRef.current.push(payload);
          
          if (realtimeFlushTimerRef.current) {
            clearTimeout(realtimeFlushTimerRef.current);
          }
          realtimeFlushTimerRef.current = setTimeout(processRealtimeBuffer, REALTIME_BUFFER_MS);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime connected to room:', id);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error:', err);
        }
      });
    
    return () => {
      supabase.removeChannel(channel);
      if (profileFetchTimerRef.current) {
        clearTimeout(profileFetchTimerRef.current);
      }
      if (realtimeFlushTimerRef.current) {
        clearTimeout(realtimeFlushTimerRef.current);
      }
    };
    }, [id, user?.id, fetchRoomAndUser, processRealtimeBuffer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active' &&
        lastSeenCreatedAtRef.current &&
        id
      ) {
        fetchMessagesSince(lastSeenCreatedAtRef.current);
      }
      
      // Update active_room_id when app state changes
      if (user?.id && id) {
        if (nextAppState === 'active') {
          supabase.from('profiles').update({ active_room_id: id }).eq('id', user.id).then();
        } else {
          supabase.from('profiles').update({ active_room_id: null }).eq('id', user.id).then();
        }
      }
      
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [id, fetchMessagesSince, user?.id]);

  useEffect(() => {
    if (id) {
      setActiveChatRoomId(id);
      return () => {
        setActiveChatRoomId(null);
      };
    }
  }, [id, setActiveChatRoomId]);

  useEffect(() => {
    if (user?.id && id) {
      supabase.from('profiles').update({ active_room_id: id }).eq('id', user.id).then();
      return () => {
        supabase.from('profiles').update({ active_room_id: null }).eq('id', user.id).then();
      };
    }
  }, [id, user?.id]);

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
        setCurrentDistance(distance);
        const radius = room.radius || CHAT_RADIUS_METERS;
        
        // Use a much larger grace radius (5km) for users who have already joined the room
        // This allows "Groups" to remain active even if users move away slightly,
        // while still maintaining the "Nearby" feel for discovery.
        const graceRadius = 5000; 
        const newIsOutOfRange = distance > graceRadius; 
        
        // Only update state if it actually changes to prevent redundant renders
        setIsOutOfRange((prev) => (prev !== newIsOutOfRange ? newIsOutOfRange : prev));
      
      if (room.expires_at) {
        const now = new Date();
        const expires = new Date(room.expires_at);
        const newIsExpired = now > expires;
        setIsExpired((prev) => (prev !== newIsExpired ? newIsExpired : prev));
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
          `You need to be within ${formatDistance(room?.radius || CHAT_RADIUS_METERS)} of the room to send messages.`
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
          Alert.alert('Please Wait', 'Connecting to chat room...');
        } else {
          Alert.alert('Error', 'Room ID not resolved. Please try again.');
        }
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const client_msg_id = generateUUID();
      const optimisticMessage: Message = {
        id: `temp:${client_msg_id}`,
        room_id: id,
        sender_id: user.id,
        content: finalContent,
        type: type,
        created_at: new Date().toISOString(),
        client_msg_id,
        isOptimistic: true,
        status: 'sending',
        sender: {
          id: user.id,
          username: user.user_metadata?.username || null,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      };

      queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
          if (!oldData) return { messages: [optimisticMessage], nextCursor: null, hasMore: false };
          return { ...oldData, messages: [optimisticMessage, ...(oldData.messages || [])] };
        });



        if (type === 'text') {
        setNewMessage('');
        clearDraft(id);
      }

        try {
          const loc = locationRef.current;
          const data = await apiRequest('/messages', {
            method: 'POST',
            body: JSON.stringify({
              room_id: id,
              sender_id: user.id,
              content: finalContent,
              type: type,
              client_msg_id,
              sender_lat: loc?.coords.latitude,
              sender_lng: loc?.coords.longitude,
            }),
          });


        if (!data || data.error) {
          throw new Error(data?.message || data?.error || 'Failed to send');
        }

        queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            messages: oldData.messages.map((m: Message) =>
              m.client_msg_id === client_msg_id
                ? { ...m, id: data.id, isOptimistic: false, status: 'sent' as const }
                : m
            ),
          };
        });
      } catch (error: any) {
        console.error('Error sending message:', error);

        queryClient.setQueryData(['chatMessages', id], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            messages: oldData.messages.map((m: Message) =>
              m.client_msg_id === client_msg_id ? { ...m, status: 'failed' as const } : m
            ),
          };
        });

        if (type === 'text') {
          setNewMessage(finalContent);
          setDraft(id, finalContent);
        }

        if (error.message?.includes('Rate limit')) {
          Alert.alert('Slow Down', 'You are sending messages too quickly. Please wait a moment.');
        } else if (error.message?.includes('Out of range') || error.error === 'Out of range') {
          Alert.alert('Out of Range', error.message || 'You are too far from this location.');
        } else if (error.code === '23503') {
          setRoomNotFound(true);
          Alert.alert('Error', 'This room no longer exists.');
        } else {
          Alert.alert('Error', error.message || 'Failed to send message. Please check your connection.');
        }
      }
    },
    [id, user, newMessage, roomNotFound, isExpired, isOutOfRange, room?.type, isResolvingId, clearDraft, setDraft, queryClient]
  );

  const pickImage = useCallback(async () => {
    if (isOutOfRange && room?.type !== 'private') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.3,
      exif: false,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  }, [isOutOfRange, room?.type]);

  const takePicture = useCallback(async () => {
    if (isOutOfRange && room?.type !== 'private') return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.3, exif: false });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  }, [isOutOfRange, room?.type]);

  const uploadImage = useCallback(
    async (uri: string) => {
      setUploading(true);
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        const fileName = `${id}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('chat-images').upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from('chat-images').getPublicUrl(fileName);
        await sendMessage(publicUrl, 'image');
      } catch (error) {
        console.error('Upload failed:', error);
        Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
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
        headerTitle: () => (
          <View>
            <TouchableOpacity
              onPress={() => {
                if (room?.type === 'private' && room?.otherUserId) {
                  router.push(`/user/${room.otherUserId}`);
                }
              }}
              disabled={room?.type !== 'private' || !room?.otherUserId}
              style={{ flexDirection: 'row', alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Text
                style={{ color: theme.foreground, fontSize: 17, fontWeight: '700' }}
                numberOfLines={1}>
                {formatRoomName(room?.name)}
              </Text>
              {room?.type === 'private' && room?.otherUserId && (
                <ChevronRight size={14} color={theme.mutedForeground} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
              {room?.type !== 'private' && (
                <Text style={{ color: isOutOfRange ? '#ef4444' : theme.mutedForeground, fontSize: 11, fontWeight: '600' }}>
                  {isOutOfRange ? 'Out of zone' : `${formatGeographicDistance(currentDistance || 0)} from center`} • {formatGeographicDistance(room?.radius || CHAT_RADIUS_METERS)} zone
                </Text>
              )}
          </View>
      ),

      headerStyle: { backgroundColor: theme.background },
      headerTitleStyle: { color: theme.foreground, fontSize: 17, fontWeight: '600' as any },
      headerShadowVisible: false,
    }),
    [room?.name, room?.type, room?.otherUserId, headerLeftComponent, theme.background, theme.foreground, router]
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
        <View className={`mb-4 flex-row ${isMine ? 'justify-end' : 'justify-start items-end'}`}>
          {!isMine && (
            <TouchableOpacity 
              onPress={() => router.push(`/user/${item.sender_id}`)}
              activeOpacity={0.7}
              className="mr-2 mb-1"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary overflow-hidden">
                {item.sender?.avatar_url ? (
                  <Image
                    source={{ uri: item.sender.avatar_url }}
                    style={{ width: 32, height: 32 }}
                    contentFit="cover"
                  />
                ) : (
                  <User size={16} color={theme.mutedForeground} />
                )}
              </View>
            </TouchableOpacity>
          )}
          <View
            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
              isMine ? 'rounded-br-none bg-primary' : 'rounded-bl-none bg-secondary/80'
            }`}>
            {!isMine && room?.type !== 'private' && (
              <TouchableOpacity onPress={() => router.push(`/user/${item.sender_id}`)}>
                <Text className="mb-1 text-[11px] font-black text-primary uppercase tracking-wider">
                  {item.sender?.full_name || item.sender?.username || 'User'}
                </Text>
              </TouchableOpacity>
            )}
            {item.type === 'image' ? (
                    <TouchableOpacity onPress={() => setSelectedImage(item.content)} activeOpacity={0.9}>
                      <View className="overflow-hidden rounded-lg">
                        <Image
                          source={{ uri: item.content }}
                          style={{ width: 256, height: 192 }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={150}
                        />
                      </View>
                    </TouchableOpacity>
                  ) : item.type === 'gif' ? (
                    <TouchableOpacity onPress={() => setSelectedImage(item.content)} activeOpacity={0.9}>
                      <View className="overflow-hidden rounded-lg">
                        <Image
                          source={{ uri: item.content }}
                          style={{ width: 256, height: 192 }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      </View>
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

  if (resolutionError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Stack.Screen options={defaultHeaderOptions} />
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-red-500/10 mb-6">
          <X size={40} color="#ef4444" strokeWidth={2.5} />
        </View>
        <Text className="text-xl font-bold text-foreground text-center">Chat Unavailable</Text>
        <Text className="mt-2 text-center text-muted-foreground mb-8">{resolutionError}</Text>
        <TouchableOpacity
          onPress={() => {
            setResolutionError(null);
            resolveRoomId();
          }}
          className="bg-primary px-8 py-3.5 rounded-2xl shadow-sm">
          <Text className="font-bold text-primary-foreground text-base">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (initialLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={defaultHeaderOptions} />
      </View>
    );
  }

  if (roomNotFound || isExpired) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Stack.Screen options={defaultHeaderOptions} />
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-secondary mb-6">
          <Lock size={40} color={theme.mutedForeground} opacity={0.5} />
        </View>
        <Text className="text-xl font-bold text-foreground text-center">
          {roomNotFound ? 'Room Not Found' : 'Chat Expired'}
        </Text>
        <Text className="mt-2 text-center text-muted-foreground mb-8">
          {roomNotFound 
            ? 'This chat room is no longer active or may have been deleted.' 
            : 'This ephemeral chat has reached its 24-hour limit and is no longer active.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/chats')}
          className="bg-primary px-8 py-3.5 rounded-2xl shadow-sm">
          <Text className="font-bold text-primary-foreground text-base">Back to Chats</Text>
        </TouchableOpacity>
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
            <FlatList
              ref={listRef}
              data={messagesWithSeparators}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              inverted={true}
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
              <View className="border-t border-border bg-card px-4 py-3">
                <View className="flex-row items-center rounded-2xl bg-secondary/50 px-4 py-3 border border-border/50">
                  <Lock size={18} color={theme.mutedForeground} className="mr-3" />
                  <Text className="flex-1 text-[14px] font-bold text-muted-foreground tracking-tight">
                        {roomNotFound
                          ? 'This chat room is no longer active.'
                          : isExpired
                              ? 'This chat has expired.'
                              : `Read only - You are ${formatGeographicDistance(currentDistance || 0)} away (Limit: ${formatGeographicDistance(room?.radius || CHAT_RADIUS_METERS)})`}
                  </Text>
                </View>
              </View>
            ) : (
<View className="flex-row items-center border-t border-border bg-card px-4 py-3">
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
          onRequestClose={() => {
            setGifModalVisible(false);
          }}>
          <View className="flex-1 bg-background p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-black text-foreground uppercase tracking-tighter">
                GIFs
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setGifModalVisible(false);
                }}
                className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <X size={24} color={theme.foreground} />
              </TouchableOpacity>
            </View>

            <View className="mb-4 flex-row items-center rounded-2xl bg-secondary/50 px-4 py-3 border border-border/50">
              <Search size={20} color={theme.mutedForeground} />
              <TextInput
                placeholder="Search Giphy..."
                placeholderTextColor={theme.mutedForeground}
                value={gifSearch}
                onChangeText={setGifSearch}
                className="ml-2 flex-1 text-foreground font-bold"
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
                            source={{ uri: gif.images.fixed_height_small?.url || gif.images.fixed_height.url }}
                            style={{ height: 128, width: '100%' }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
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
            className="flex-1 bg-black/95 items-center justify-center"
            onPress={() => setSelectedImage(null)}>
            <TouchableOpacity 
              onPress={() => setSelectedImage(null)}
              className="absolute top-14 right-4 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <X size={24} color="#fff" />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width: '100%', height: '80%' }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
          </Pressable>
        </Modal>

        </View>
    );
  }
