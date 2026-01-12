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
            location: any | null;
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
            location?: any | null;
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
          type: 'private' | 'auto_generated';
          latitude: number | null;
          longitude: number | null;
          radius: number | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: 'private' | 'auto_generated';
          latitude?: number | null;
          longitude?: number | null;
          radius?: number | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: 'private' | 'auto_generated';
          latitude?: number | null;
          longitude?: number | null;
          radius?: number | null;
          expires_at?: string | null;
          created_at?: string;
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
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          content: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          content?: string;
          is_read?: boolean;
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
      friend_requests: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          status: 'pending' | 'accepted' | 'declined';
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          status?: 'pending' | 'accepted' | 'declined';
          created_at?: string;
        };
      };
    };
  };
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables!');
}

// Create Supabase client safely
let supabase: ReturnType<typeof createClient<Database>>;
try {
  if (!supabaseUrl) throw new Error('SUPABASE_URL is missing');
  supabase = createClient<Database>(supabaseUrl, supabaseKey || '');
  console.log('Supabase client initialized successfully');
} catch (err) {
  const error = err as Error;
  console.error('CRITICAL: Failed to initialize Supabase client:', error.message);
}

// Initialize Resend
const resend = resendApiKey ? new Resend(resendApiKey) : null;
if (!resend) {
  console.warn('WARNING: RESEND_API_KEY is missing. Welcome emails will be disabled.');
}

// 3. App Initialization
const app = new Hono();

app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
  })
);

// 4. Endpoints

// Health Check
app.get('/health', async (c) => {
  // Try to run cleanup occasionally on health checks
  try {
    if (Math.random() < 0.1) { // 10% of health checks trigger cleanup
      await supabase.rpc('cleanup_expired_rooms');
    }
  } catch (e) {
    console.error('Cleanup failed:', e);
  }

  return c.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    supabase: !!supabaseUrl && !!supabaseKey,
    resend: !!resendApiKey,
  });
});

app.get('/', (c) => c.text('Tap In API v1.0.0 is Running'));

// POST /auth/welcome - Send tailored welcome email
app.post(
  '/auth/welcome',
  zValidator(
    'json',
    z.object({
      id: z.string(),
      email: z.string().email(),
      full_name: z.string().optional(),
    })
  ),
  async (c) => {
    const { email, full_name } = c.req.valid('json');

    if (!resend) {
      return c.json({ error: 'Email service not configured' }, 500);
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Tap In <welcome@updates.tapin.app>',
        to: email,
        subject: 'Welcome to Tap In!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h1 style="color: #3b82f6; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome to Tap In, ${full_name || 'there'}! 🚀</h1>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
              We're thrilled to have you join our community. Tap In helps you connect with people and discover what's happening right where you are.
            </p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
              <h2 style="color: #1e293b; font-size: 18px; font-weight: 600; margin-bottom: 12px;">Getting Started:</h2>
              <ul style="color: #4b5563; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>📍 <strong>Find Chats:</strong> Look at the map or list to find chats happening within 1km.</li>
                <li>💬 <strong>Join In:</strong> Tap any chat room to start messaging people nearby.</li>
                <li>✨ <strong>Create:</strong> Use the "Create Chat Here" button to start your own 48-hour localized chat!</li>
              </ul>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
              Stay connected,
            </p>
            <p style="color: #1e293b; font-weight: bold; font-size: 16px;">
              The Tap In Team
            </p>
          </div>
        `,
      });

      if (error) throw error;
      return c.json({ success: true, id: data?.id });
    } catch (err) {
      const error = err as Error;
      console.error('Error sending welcome email:', error);
      return c.json({ error: error.message }, 500);
    }
  }
);

// POST /rooms/private - Create or get private chat room
app.post(
  '/rooms/private',
  zValidator(
    'json',
    z.object({
      user1_id: z.string(),
      user2_id: z.string(),
    })
  ),
  async (c) => {
    const { user1_id, user2_id } = c.req.valid('json');

    try {
      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('type', 'private')
        .returns<{ id: string }[]>();

      if (existingRooms && existingRooms.length > 0) {
        const roomIds = existingRooms.map((r) => r.id);
        const { data: participants } = await supabase
          .from('room_participants')
          .select('room_id')
          .in('room_id', roomIds)
          .in('user_id', [user1_id, user2_id]);

        if (participants) {
          const counts: Record<string, number> = {};
          for (const p of participants) {
            counts[p.room_id] = (counts[p.room_id] || 0) + 1;
            if (counts[p.room_id] === 2) {
              return c.json({ room_id: p.room_id });
            }
          }
        }
      }

      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: 'Private Chat',
          type: 'private',
        })
        .select()
        .single();

      if (roomError) throw roomError;

      const { error: partError } = await supabase.from('room_participants').insert([
        { room_id: newRoom.id, user_id: user1_id },
        { room_id: newRoom.id, user_id: user2_id },
      ]);

      if (partError) throw partError;

      return c.json({ room_id: newRoom.id });
    } catch (err) {
      const error = err as Error;
      console.error('Error in /rooms/private:', error);
      return c.json({ error: error.message }, 500);
    }
  }
);

// POST /rooms/sync - Location sync only (removed auto-room generation)
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
      await supabase
        .from('profiles')
        .update({
          latitude: latitude,
          longitude: longitude,
          location: `POINT(${longitude} ${latitude})`,
          location_name: address || null,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);

      return c.json({ success: true });
    } catch (err) {
      const error = err as Error;
      console.error('Error in /rooms/sync:', error);
      return c.json({ error: error.message }, 500);
    }
  }
);

// GET /messages/:roomId - Get message history
app.get('/messages/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(id, username, full_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return c.json(data || []);
  } catch (err) {
    const error = err as Error;
    return c.json({ error: error.message }, 500);
  }
});

// POST /messages - Send a message
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
    const payload = c.req.valid('json');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select(`
          *,
          sender:profiles(id, username, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return c.json(data);
    } catch (err) {
      const error = err as Error;
      return c.json({ error: error.message }, 500);
    }
  }
);

// POST /rooms/create - Explicitly create a chat room
app.post(
  '/rooms/create',
  zValidator(
    'json',
    z.object({
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().default(20),
    })
  ),
  async (c) => {
    const { name, latitude, longitude, radius } = c.req.valid('json');

    try {
      // Check if a room already exists within 20m to prevent duplicates
      const { data: existingRooms, error: searchError } = await supabase.rpc('find_nearby_rooms', {
        lat: latitude,
        lng: longitude,
        max_dist_meters: 20,
      });

      if (searchError) throw searchError;

      if (existingRooms && existingRooms.length > 0) {
        return c.json({ error: 'A chat already exists in this exact location (20m radius).' }, 400);
      }

      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          name,
          type: 'auto_generated',
          latitude,
          longitude,
          radius,
          // Default expires_at is now() + 48 hours set in DB
        })
        .select()
        .single();

      if (error) throw error;
      return c.json({ success: true, room: newRoom });
    } catch (err) {
      const error = err as Error;
      console.error('Error in /rooms/create:', error);
      return c.json({ error: error.message }, 500);
    }
  }
);

// GET /rooms/nearby - List active nearby rooms using PostGIS
app.get('/rooms/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const radius = parseFloat(c.req.query('radius') || '1000'); // Default search radius 1km

  try {
    const { data: rooms, error } = await supabase.rpc('find_nearby_rooms', {
      lat,
      lng,
      max_dist_meters: radius,
    });

    if (error) throw error;

    // Filter out expired rooms
    const now = new Date();
    const activeRooms = (rooms || []).filter((r: any) => {
      if (!r.expires_at) return true;
      return new Date(r.expires_at) > now;
    });

    return c.json(activeRooms);
  } catch (err) {
    const error = err as Error;
    console.error('Error in /rooms/nearby:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /rooms/:roomId/join - Join a chat room
app.post(
  '/rooms/:roomId/join',
  zValidator(
    'json',
    z.object({
      userId: z.string(),
    })
  ),
  async (c) => {
    const roomId = c.req.param('roomId');
    const { userId } = c.req.valid('json');

    try {
      // Check if already a participant
      const { data: existing } = await supabase
        .from('room_participants')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        return c.json({ success: true, message: 'Already a participant' });
      }

      const { error } = await supabase.from('room_participants').insert({
        room_id: roomId,
        user_id: userId,
      });

      if (error) throw error;
      return c.json({ success: true });
    } catch (err) {
      const error = err as Error;
      return c.json({ error: error.message }, 500);
    }
  }
);

// GET /notifications/:userId - List notifications
app.get('/notifications/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return c.json(data || []);
  } catch (err) {
    const error = err as Error;
    return c.json({ error: error.message }, 500);
  }
});

// GET /profiles/search - Search for users
app.get('/profiles/search', async (c) => {
  const query = c.req.query('q') || '';
  const userId = c.req.query('userId');

  if (!query) return c.json([]);

  try {
    let supabaseQuery = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    if (userId) {
      supabaseQuery = supabaseQuery.neq('id', userId);
    }

    const { data, error } = await supabaseQuery;
    if (error) throw error;
    return c.json(data || []);
  } catch (err) {
    const error = err as Error;
    return c.json({ error: error.message }, 500);
  }
});

// GET /profiles/nearby - List nearby users
app.get('/profiles/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const radius = parseFloat(c.req.query('radius') || '1000');
  const userId = c.req.query('userId');

  try {
    // Using simple distance calculation for now if PostGIS RPC is not available for profiles
    // But since we have location column, we can use it.
    // Let's try to use a RPC if it exists, otherwise use a fallback.
    const { data, error } = await supabase.rpc('find_nearby_users', {
      lat,
      lng,
      max_dist_meters: radius,
    });

    if (error) {
      console.warn('find_nearby_users RPC failed, falling back to simple query');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, latitude, longitude')
        .neq('id', userId || '')
        .limit(50);
      
      if (fallbackError) throw fallbackError;
      return c.json(fallbackData || []);
    }

    let results = data || [];
    if (userId) {
      results = results.filter((u: any) => u.id !== userId);
    }

    return c.json(results);
  } catch (err) {
    const error = err as Error;
    return c.json({ error: error.message }, 500);
  }
});

// GET /friends/:userId - List friends
app.get('/friends/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        user_id_1,
        user_id_2,
        profiles!friends_user_id_1_fkey(id, username, full_name, avatar_url),
        profiles_2:profiles!friends_user_id_2_fkey(id, username, full_name, avatar_url)
      `)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (error) throw error;

    const friends = (data || []).map((f: any) => {
      return f.user_id_1 === userId ? f.profiles_2 : f.profiles;
    });

    return c.json(friends);
  } catch (err) {
    const error = err as Error;
    return c.json({ error: error.message }, 500);
  }
});

// GET /friends/requests/:userId - List incoming friend requests
app.get('/friends/requests/:userId', async (c) => {
  const userId = c.req.param('userId');
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status, created_at, sender:profiles!friend_requests_sender_id_fkey(id, username, full_name, avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return c.json(data || []);
  } catch (err) {
    const error = err as Error;
    return c.json({ error: error.message }, 500);
  }
});

// POST /friends/request - Send friend request
app.post(
  '/friends/request',
  zValidator(
    'json',
    z.object({
      sender_id: z.string(),
      receiver_id: z.string(),
    })
  ),
  async (c) => {
    const { sender_id, receiver_id } = c.req.valid('json');

    try {
      // Check if already friends or request exists
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(sender_id.eq.${sender_id},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${sender_id})`)
        .single();

      if (existing) {
        return c.json({ error: 'Request already exists or you are already connected' }, 400);
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id,
          receiver_id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert({
        user_id: receiver_id,
        type: 'friend_request',
        content: 'You have a new friend request!',
      });

      return c.json(data);
    } catch (err) {
      const error = err as Error;
      return c.json({ error: error.message }, 500);
    }
  }
);

// POST /friends/accept - Accept friend request
app.post(
  '/friends/accept',
  zValidator(
    'json',
    z.object({
      request_id: z.string(),
    })
  ),
  async (c) => {
    const { request_id } = c.req.valid('json');

    try {
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', request_id)
        .single();

      if (fetchError || !request) throw new Error('Request not found');

      // Update request status
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', request_id);

      // Add to friends table
      const { error: friendError } = await supabase.from('friends').insert({
        user_id_1: request.sender_id,
        user_id_2: request.receiver_id,
      });

      if (friendError) throw friendError;

      // Create notification for sender
      await supabase.from('notifications').insert({
        user_id: request.sender_id,
        type: 'friend_request_accepted',
        content: 'Your friend request was accepted!',
      });

      return c.json({ success: true });
    } catch (err) {
      const error = err as Error;
      return c.json({ error: error.message }, 500);
    }
  }
);

// PATCH /profiles/:userId - Update profile
app.patch(
  '/profiles/:userId',
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
    const userId = c.req.param('userId');
    const updates = c.req.valid('json');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return c.json(data);
    } catch (err) {
      const error = err as Error;
      return c.json({ error: error.message }, 500);
    }
  }
);

export default app;
