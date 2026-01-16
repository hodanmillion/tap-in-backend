import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function useNearbyRooms(lat?: number, lng?: number) {
  return useQuery({
    queryKey: ['nearbyRooms', lat?.toFixed(2), lng?.toFixed(2)],
    queryFn: () => apiRequest(`/rooms/nearby?lat=${lat}&lng=${lng}`),
    enabled: lat !== undefined && lng !== undefined,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    placeholderData: (prev) => prev,
  });
}

export function useNearbyUsers(lat?: number, lng?: number, userId?: string) {
  return useQuery({
    queryKey: ['nearbyUsers', lat?.toFixed(2), lng?.toFixed(2)],
    queryFn: () => apiRequest(`/profiles/nearby?lat=${lat}&lng=${lng}&radius=5000&userId=${userId}`),
    enabled: lat !== undefined && lng !== undefined && !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    placeholderData: (prev) => prev,
  });
}

export function useMessages(roomId: string) {
  return useQuery({
    queryKey: ['messages', roomId],
    queryFn: () => apiRequest(`/messages/${roomId}`),
    enabled: !!roomId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 10,
  });
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => apiRequest(`/notifications/${userId}`),
    enabled: !!userId,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });
}

export function useFriends(userId?: string) {
  return useQuery({
    queryKey: ['friends', userId],
    queryFn: () => apiRequest(`/friends/${userId}`),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (content: string) =>
      apiRequest('/messages', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          sender_id: user?.id,
          content,
          type: 'text',
        }),
      }),
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['messages', roomId] });
      const previous = queryClient.getQueryData(['messages', roomId]);
      
      queryClient.setQueryData(['messages', roomId], (old: any[] = []) => [
        ...old,
        {
          id: `temp-${Date.now()}`,
          room_id: roomId,
          sender_id: user?.id,
          content,
          type: 'text',
          created_at: new Date().toISOString(),
          sender: { id: user?.id, username: user?.user_metadata?.username },
          _optimistic: true,
        },
      ]);

      return { previous };
    },
    onError: (_err, _content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages', roomId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', roomId] });
    },
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (receiverId: string) =>
      apiRequest('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ sender_id: user?.id, receiver_id: receiverId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nearbyUsers'] });
    },
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: { name: string; latitude: number; longitude: number; radius?: number }) =>
      apiRequest('/rooms/create', {
        method: 'POST',
        body: JSON.stringify({ ...data, userId: user?.id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nearbyRooms'] });
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationIds: string[]) =>
      apiRequest('/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notificationIds }),
      }),
    onMutate: async (notificationIds) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any[] = []) =>
        old.map((n) =>
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
    },
  });
}
