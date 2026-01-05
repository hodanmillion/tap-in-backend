import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Image as ImageIcon, Mic } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
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

  async function fetchRoomAndUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    const { data } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', id)
      .single();
    setRoom(data);
    setLoading(false);
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name, avatar_url)')
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setMessages(data);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !user) return;

    const message = {
      room_id: id,
      sender_id: user.id,
      content: newMessage,
      type: 'text',
    };

    setNewMessage('');
    
    const { error } = await supabase.from('messages').insert(message);
    if (error) console.error('Error sending message:', error);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
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
                className={`mb-4 max-w-[80%] rounded-2xl p-3 ${
                  isMine
                    ? 'self-end bg-primary rounded-tr-none'
                    : 'self-start bg-muted rounded-tl-none'
                }`}
              >
                {!isMine && (
                  <Text className="mb-1 text-xs font-bold text-muted-foreground">
                    {item.profiles?.full_name || 'User'}
                  </Text>
                )}
                <Text
                  className={`text-base ${
                    isMine ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {item.content}
                </Text>
                <Text
                  className={`mt-1 text-[10px] opacity-70 ${
                    isMine ? 'text-primary-foreground text-right' : 'text-muted-foreground'
                  }`}
                >
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />

        <View className="flex-row items-center border-t border-border bg-card p-4 pb-8">
          <TouchableOpacity className="mr-3">
            <Mic size={24} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity className="mr-3">
            <ImageIcon size={24} color="#6b7280" />
          </TouchableOpacity>
          <View className="mr-3 flex-1 rounded-full bg-muted px-4 py-2">
            <TextInput
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
              className="text-base text-foreground"
              multiline
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            className={`h-10 w-10 items-center justify-center rounded-full bg-primary ${
              !newMessage.trim() && 'opacity-50'
            }`}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
