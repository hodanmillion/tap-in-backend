import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Resend } from 'resend';

// 1. Error Handling & Logging Setup
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('--- STARTING BACKEND SERVER ---');
console.log('Timestamp:', new Date().toISOString());
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 3003);

// 2. Supabase & Resend Configuration
interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          full_name: string | null;
          avatar_url: string | null;
          latitude: number | null;
          longitude: number | null;
          location: unknown | null;
          last_seen: string | null;
          bio: string | null;
          website: string | null;
          location_name: string | null;
          occupation: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location?: unknown | null;
          last_seen?: string | null;
          bio?: string | null;
          website?: string | null;
          location_name?: string | null;
          occupation?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          location?: unknown | null;
          last_seen?: string | null;
          bio?: string | null;
          website?: string | null;
          location_name?: string | null;
          occupation?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          content: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          sender_id: string;
          content: string;
          type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          sender_id?: string;
          content?: string;
          type?: string;
          created_at?: string;
        };
      };
      chat_rooms: {
        Row: {
          id: string;
          name: string;
          type: string;
          latitude: number;
          longitude: number;
          radius: number;
          created_at: string;
          expires_at: string | null;
          location: unknown | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          latitude: number;
          longitude: number;
          radius: number;
          created_at?: string;
          expires_at?: string | null;
          location?: unknown | null;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          latitude?: number;
          longitude?: number;
          radius?: number;
          created_at?: string;
          expires_at?: string | null;
          location?: unknown | null;
        };
      };
      room_participants: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          joined_at?: string;
        };
      };
      friend_requests: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          status?: string;
          created_at?: string;
        };
      };
      friends: {
        Row: {
          id: string;
          user_id_1: string;
          user_id_2: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id_1: string;
          user_id_2: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id_1?: string;
          user_id_2?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string | null;
          content: string;
          data: any | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title?: string | null;
          content: string;
          data?: any | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string | null;
          content?: string;
          data?: any | null;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Functions: {
      cleanup_expired_rooms: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      find_nearby_rooms: {
        Args: {
          lat: number;
          lng: number;
          max_dist_meters: number;
        };
        Returns: Array<Database['public']['Tables']['chat_rooms']['Row'] & { distance: number }>;
      };
      find_nearby_users: {
        Args: {
          lat: number;
          lng: number;
          max_dist_meters: number;
        };
        Returns: Array<Database['public']['Tables']['profiles']['Row'] & { distance: number }>;
      };
    };
  };
}

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const app = new Hono();
app.use('*', cors());

// --- ROUTES ---

// 3. Profiles
app.get('/profiles/:id', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

app.post(
  '/profiles',
  zValidator(
    'json',
    z.object({
      id: z.string(),
      username: z.string().optional(),
      full_name: z.string().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');
    const { data, error } = await supabase
      .from('profiles')
      .upsert(body)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 400);
    return c.json(data);
  }
);

app.patch(
  '/profiles/:id',
  zValidator(
    'json',
    z.object({
      full_name: z.string().optional(),
      username: z.string().optional(),
      avatar_url: z.string().optional(),
      bio: z.string().optional(),
      website: z.string().optional(),
      location_name: z.string().optional(),
      occupation: z.string().optional(),
    })
  ),
  async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const { data, error } = await supabase
      .from('profiles')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 400);
    return c.json(data);
  }
);

// 4. Rooms & Location Sync
app.post(
  '/rooms/sync',
  zValidator(
    'json',
    z.object({
      userId: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      address: z.string().optional(),
    })
  ),
  async (c) => {
    const { userId, latitude, longitude, address } = c.req.valid('json');

    try {
      // 1. Cleanup expired rooms
      await supabase.rpc('cleanup_expired_rooms');

      // 2. Update user location
      await supabase
        .from('profiles')
        .update({
          latitude,
          longitude,
          location_name: address,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);

      // 3. Find nearby rooms (radius 500m)
      const { data: existingRooms, error: searchError } = await supabase.rpc('find_nearby_rooms', {
        lat: latitude,
        lng: longitude,
        max_dist_meters: 500,
      });

      if (searchError) throw searchError;

      // 4. If no nearby rooms, create a default "Nearby Chat"
      if (!existingRooms || existingRooms.length === 0) {
        const { data: newRoom, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            name: address || `Chat near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
            type: 'public',
            latitude,
            longitude,
            radius: 500,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
          })
          .select()
          .single();

        if (createError) throw createError;

        // Auto-join the creator
        await supabase.from('room_participants').insert({
          room_id: newRoom.id,
          user_id: userId,
        });

        return c.json({ rooms: [newRoom] });
      }

      // 5. Auto-join user to all nearby rooms they aren't in
      const roomIds = existingRooms.map((r) => r.id);
      const { data: currentMemberships } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', userId)
        .in('room_id', roomIds);

      const joinedRoomIds = currentMemberships?.map((m) => m.room_id) || [];
      const roomsToJoin = roomIds.filter((id) => !joinedRoomIds.includes(id));

      if (roomsToJoin.length > 0) {
        await supabase.from('room_participants').insert(
          roomsToJoin.map((id) => ({
            room_id: id,
            user_id: userId,
          }))
        );
      }

      return c.json({ rooms: existingRooms });
    } catch (err: any) {
      console.error('Sync Error:', err);
      return c.json({ error: err.message }, 500);
    }
  }
);

app.get('/rooms/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const dist = parseInt(c.req.query('dist') || '1000');

  const { data: rooms, error } = await supabase.rpc('find_nearby_rooms', {
    lat,
    lng,
    max_dist_meters: dist,
  });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(rooms);
});

app.get('/users/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const dist = parseInt(c.req.query('dist') || '5000');

  const { data, error } = await supabase.rpc('find_nearby_users', {
    lat,
    lng,
    max_dist_meters: dist,
  });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// 5. Chat & Messages
app.get('/rooms/:roomId/messages', async (c) => {
  const roomId = c.req.param('roomId');
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(id, username, avatar_url)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post(
  '/messages',
  zValidator(
    'json',
    z.object({
      room_id: z.string(),
      sender_id: z.string(),
      content: z.string(),
      type: z.string().default('text'),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');
    const { data, error } = await supabase
      .from('messages')
      .insert(body)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 400);
    return c.json(data);
  }
);

// 6. Room Management
app.get('/users/:userId/rooms', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('room_participants')
    .select(`
      room_id,
      chat_rooms (*)
    `)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data.map((item: any) => item.chat_rooms));
});

app.post('/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId');
  const { userId } = await c.req.json();
  const { data, error } = await supabase
    .from('room_participants')
    .insert({ room_id: roomId, user_id: userId })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

app.delete('/rooms/:roomId/leave', async (c) => {
  const roomId = c.req.param('roomId');
  const { userId } = await c.req.json();
  const { error } = await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true });
});

// 7. Notifications
app.get('/notifications/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.patch('/notifications/:id/read', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

// 8. Friends & Social
app.get('/friends/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('friends')
    .select(`
      *,
      user_1:profiles!user_id_1(*),
      user_2:profiles!user_id_2(*)
    `)
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

  if (error) return c.json({ error: error.message }, 500);

  // Map to only return the "friend" profile
  const friends = data.map((f: any) => (f.user_id_1 === userId ? f.user_2 : f.user_1));
  return c.json(friends);
});

app.get('/friend-requests/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      *,
      sender:profiles!sender_id(*)
    `)
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post('/friend-requests', async (c) => {
  const { sender_id, receiver_id } = await c.req.json();

  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id, receiver_id, status: 'pending' })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  // Notify receiver
  await supabase.from('notifications').insert({
    user_id: receiver_id,
    type: 'friend_request',
    content: 'You have a new friend request!',
  });

  return c.json(data);
});

app.post('/friend-requests/:id/respond', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json(); // 'accepted' or 'rejected'

  const { data: request, error: fetchError } = await supabase
    .from('friend_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (fetchError) return c.json({ error: fetchError.message }, 400);

  if (status === 'accepted') {
    // Add to friends table
    await supabase.from('friends').insert({
      user_id_1: request.sender_id,
      user_id_2: request.receiver_id,
    });

    // Notify sender
    await supabase.from('notifications').insert({
      user_id: request.sender_id,
      type: 'friend_request_accepted',
      content: 'Your friend request was accepted!',
    });
  }

  return c.json(request);
});

// 9. Resend Integration (Email Notifications)
app.post('/email/notification', async (c) => {
  const { to, subject, body } = await c.req.json();

  try {
    const data = await resend.emails.send({
      from: 'TapIn <notifications@tapin.pro>',
      to: [to],
      subject,
      html: body,
    });
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const port = process.env.PORT || 3003;
console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
