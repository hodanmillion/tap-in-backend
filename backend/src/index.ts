import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

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
console.log('Port:', process.env.PORT || 3002);

// 2. Supabase Configuration
interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          last_latitude: number | null;
          last_longitude: number | null;
          last_seen_at: string | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          last_latitude?: number | null;
          last_longitude?: number | null;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          last_latitude?: number | null;
          last_longitude?: number | null;
          last_seen_at?: string | null;
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
    };
  };
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables!');
  console.log('Available Env Vars:', Object.keys(process.env).join(', '));
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
  // We don't exit here, but the server will fail on requests that need Supabase
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

// Health Check (Crucial for Render)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    supabase: !!supabaseUrl && !!supabaseKey,
  });
});

app.get('/', (c) => c.text('Tap In API v1.0.0 is Running'));

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
      // 1. Check if private room already exists
      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('type', 'private')
        .returns<{ id: string }[]>();

      if (existingRooms && existingRooms.length > 0) {
        const roomIds = existingRooms.map((r) => r.id);

        // Find room where both users are participants
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

      // 2. Create new private room if none found
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: 'Private Chat',
          type: 'private',
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // 3. Add both participants
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

// POST /rooms/sync - Location sync and auto-room generation
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
      // 1. Update user location in profiles
      await supabase
        .from('profiles')
        .update({
          last_latitude: latitude,
          last_longitude: longitude,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId);

      // 2. Check for nearby auto-generated rooms (within 20m)
      // Note: In a production app, use PostGIS or a more efficient geofence.
      // For this MVP, we fetch recent auto-rooms and filter.
      const { data: nearbyRooms } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('type', 'auto_generated')
        .gt('expires_at', new Date().toISOString());

      const R = 6371000; // Meters
      const radius = 20;

      let currentRoom = nearbyRooms?.find((room) => {
        const dLat = (room.latitude - latitude) * (Math.PI / 180);
        const dLon = (room.longitude - longitude) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(latitude * (Math.PI / 180)) *
            Math.cos(room.latitude * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return d <= (room.radius || radius);
      });

      // 3. Create room if none found nearby
      if (!currentRoom) {
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
        const { data: newRoom, error } = await supabase
          .from('chat_rooms')
          .insert({
            name: address || `Nearby Chat (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            type: 'auto_generated',
            latitude,
            longitude,
            radius,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (error) throw error;
        currentRoom = newRoom;
      }

      return c.json({ success: true, room: currentRoom });
    } catch (err) {
      const error = err as Error;
      console.error('Error in /rooms/sync:', error);
      return c.json({ error: error.message }, 500);
    }
  }
);

// GET /rooms/nearby - List active nearby rooms
app.get('/rooms/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');

  try {
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .or(`expires_at.gt.${new Date().toISOString()},type.eq.private`);

    if (error) throw error;

    // Filter by distance (20m for auto, or all private)
    const R = 6371000;
    const filtered = rooms.filter((room) => {
      if (room.type === 'private') return false; // Handled separately in chats tab

      const dLat = (room.latitude - lat) * (Math.PI / 180);
      const dLon = (room.longitude - lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * (Math.PI / 180)) *
          Math.cos(room.latitude * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return d <= (room.radius || 20);
    });

    return c.json(filtered);
  } catch (err) {
    const error = err as Error;
    console.error('Error in /rooms/nearby:', error);
    return c.json({ error: error.message }, 500);
  }
});

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

// 5. Server Startup
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3002;

  try {
    serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`>>> SERVER READY: http://localhost:${info.port}`);
        console.log(`>>> HEALTH CHECK: http://localhost:${info.port}/health`);
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error('CRITICAL: Server failed to start:', error.message);
    process.exit(1);
  }
}

export default app;
