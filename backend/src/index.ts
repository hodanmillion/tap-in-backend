import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';
import type { Database } from './database.types';

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
const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const messageRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 2000;
const RATE_LIMIT_MAX_MESSAGES = 5;

function checkRateLimit(senderId: string): boolean {
  const now = Date.now();
  const timestamps = messageRateLimit.get(senderId) || [];
  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    return false;
  }
  
  recentTimestamps.push(now);
  messageRateLimit.set(senderId, recentTimestamps);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of messageRateLimit.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      messageRateLimit.delete(key);
    } else {
      messageRateLimit.set(key, recent);
    }
  }
}, 10000);

const app = new Hono();
app.use('*', cors());

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.2',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (c) => {
  return c.text('Tap In API v1.0.2 is Running');
});

// --- ROUTES ---

// 3. Profiles
app.get('/profiles/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const radius = parseInt(c.req.query('radius') || '5000');
  const userId = c.req.query('userId');

  const { data, error } = await supabase.rpc('find_nearby_users', {
    lat,
    lng,
    max_dist_meters: radius,
  });

  if (error) return c.json({ error: error.message }, 500);
  
  let filtered = userId ? data.filter((u: any) => u.id !== userId) : data;
  
  if (userId && filtered.length > 0) {
    const { data: friends } = await supabase
      .from('friends')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);
    
    const { data: pendingRequests } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'pending');
    
    const { data: privateRooms } = await supabase
      .from('chat_rooms')
      .select('name')
      .eq('type', 'private')
      .like('name', `%${userId}%`);
    
    const friendIds = new Set<string>();
    const pendingIds = new Set<string>();
    const privateRoomUserIds = new Set<string>();
    
    if (friends) {
      friends.forEach((f: any) => {
        friendIds.add(f.user_id_1 === userId ? f.user_id_2 : f.user_id_1);
      });
    }
    
    if (pendingRequests) {
      pendingRequests.forEach((r: any) => {
        pendingIds.add(r.sender_id === userId ? r.receiver_id : r.sender_id);
      });
    }
    
    if (privateRooms) {
      privateRooms.forEach((r: any) => {
        const parts = r.name.replace('private_', '').split('_');
        const otherUserId = parts[0] === userId ? parts[1] : parts[0];
        if (otherUserId) privateRoomUserIds.add(otherUserId);
      });
    }
    
      filtered = filtered.map((u: any) => ({
        ...u,
        connection_status: friendIds.has(u.id) || privateRoomUserIds.has(u.id) ? 'accepted' : pendingIds.has(u.id) ? 'pending' : 'none',
        has_private_room: privateRoomUserIds.has(u.id)
      }));
    }
    
    return c.json(filtered);
  });

  app.get('/profiles/search', async (c) => {
    const q = c.req.query('q') || '';
    const userId = c.req.query('userId');
  
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .eq('is_incognito', false)
      .neq('id', userId || '')
      .limit(20);

  if (error) return c.json({ error: error.message }, 500);
  
  let filtered = data || [];
  
  if (userId && filtered.length > 0) {
    const { data: friends } = await supabase
      .from('friends')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);
    
    const { data: pendingRequests } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'pending');
    
    const { data: privateRooms } = await supabase
      .from('chat_rooms')
      .select('name')
      .eq('type', 'private')
      .like('name', `%${userId}%`);
    
    const friendIds = new Set<string>();
    const pendingIds = new Set<string>();
    const privateRoomUserIds = new Set<string>();
    
    if (friends) {
      friends.forEach((f: any) => {
        friendIds.add(f.user_id_1 === userId ? f.user_id_2 : f.user_id_1);
      });
    }
    
    if (pendingRequests) {
      pendingRequests.forEach((r: any) => {
        pendingIds.add(r.sender_id === userId ? r.receiver_id : r.sender_id);
      });
    }
    
    if (privateRooms) {
      privateRooms.forEach((r: any) => {
        const parts = r.name.replace('private_', '').split('_');
        const otherUserId = parts[0] === userId ? parts[1] : parts[0];
        if (otherUserId) privateRoomUserIds.add(otherUserId);
      });
    }
    
      filtered = filtered.map((u: any) => ({
        ...u,
        connection_status: friendIds.has(u.id) || privateRoomUserIds.has(u.id) ? 'accepted' : pendingIds.has(u.id) ? 'pending' : 'none',
        has_private_room: privateRoomUserIds.has(u.id)
      }));
    }
    
    return c.json(filtered);
});

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
    const startTime = Date.now();

    try {
      await supabase.rpc('cleanup_expired_rooms');

      await supabase
        .from('profiles')
        .update({
          latitude,
          longitude,
          location_name: address,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);

      const { data: userRooms } = await supabase
        .from('room_participants')
        .select('room_id, left_at, chat_rooms(id, type, latitude, longitude, radius)')
        .eq('user_id', userId);

      if (userRooms) {
        for (const participation of userRooms) {
          const room = (participation as any).chat_rooms;
          if (room && room.type !== 'private') {
            const distance = calculateDistance(latitude, longitude, room.latitude, room.longitude);
            const radius = room.radius || 100;
            const isInZone = distance <= radius;

            if (isInZone && participation.left_at) {
              await supabase
                .from('room_participants')
                .update({ left_at: null })
                .eq('room_id', participation.room_id)
                .eq('user_id', userId);
            } else if (!isInZone && !participation.left_at) {
              await supabase
                .from('room_participants')
                .update({ left_at: new Date().toISOString() })
                .eq('room_id', participation.room_id)
                .eq('user_id', userId);
            }
          }
        }
      }

    const { data: existingRooms, error: searchError } = await supabase.rpc('find_nearby_rooms', {
      lat: latitude,
      lng: longitude,
      max_dist_meters: 1000,
    });

    if (searchError) throw searchError;

    const publicRooms = (existingRooms || []).filter((r: any) => r.type === 'public');

    if (publicRooms.length > 0) {
      const nearestRoom = publicRooms[0];
      
      const { data: existingMembership } = await supabase
        .from('room_participants')
        .select('id')
        .eq('room_id', nearestRoom.id)
        .eq('user_id', userId)
        .single();

      if (!existingMembership) {
        await supabase.from('room_participants').upsert({
          room_id: nearestRoom.id,
          user_id: userId,
          left_at: null,
        }, { onConflict: 'room_id,user_id' });
      }

      const dbMs = Date.now() - startTime;
      c.header('x-db-ms', String(dbMs));
      c.header('x-total-ms', String(dbMs));

      return c.json({
        joinedRoomIds: existingMembership ? [] : [nearestRoom.id],
        activeRoomIds: publicRooms.map((r: any) => r.id),
        serverTime: new Date().toISOString(),
      });
    }

    const roomName = address || `Chat Zone (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert({
        name: roomName,
        type: 'public',
        latitude,
        longitude,
        radius: 500,
      })
      .select()
      .single();

    if (newRoom) {
      await supabase.from('room_participants').insert({
        room_id: newRoom.id,
        user_id: userId,
      });
    }

    const dbMs = Date.now() - startTime;
    c.header('x-db-ms', String(dbMs));
    c.header('x-total-ms', String(dbMs));

    return c.json({
      joinedRoomIds: newRoom ? [newRoom.id] : [],
      activeRoomIds: newRoom ? [newRoom.id] : [],
      serverTime: new Date().toISOString(),
    });
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
  
  const seenNames = new Set<string>();
  const dedupedRooms = (rooms || []).filter((room: any) => {
    if (seenNames.has(room.name)) return false;
    seenNames.add(room.name);
    return true;
  });
  
  return c.json(dedupedRooms);
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
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor');

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(id, username, avatar_url, full_name)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) return c.json({ error: error.message }, 500);

  const hasMore = data && data.length === limit;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].created_at : null;

  return c.json({
    messages: data || [],
    nextCursor,
    hasMore,
  });
});

app.get('/messages/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor');
  const since = c.req.query('since');

  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(id, username, avatar_url, full_name)
    `)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gt('created_at', since);
  } else if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) return c.json({ error: error.message }, 500);

  const hasMore = !since && data && data.length === limit;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].created_at : null;

  return c.json({
    messages: data || [],
    nextCursor,
    hasMore,
  });
});

app.post('/rooms/private', async (c) => {
  const { user1_id, user2_id } = await c.req.json();
  
  const sortedIds = [user1_id, user2_id].sort();
  const roomName = `private_${sortedIds[0]}_${sortedIds[1]}`;
  
  const { data: existingRoom } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('name', roomName)
    .eq('type', 'private')
    .single();
  
  if (existingRoom) {
    return c.json({ room_id: existingRoom.id });
  }
  
  const { data: newRoom, error: createError } = await supabase
    .from('chat_rooms')
    .insert({
      name: roomName,
      type: 'private',
      latitude: 0,
      longitude: 0,
      radius: 0,
      expires_at: null,
    })
    .select()
    .single();
  
  if (createError) return c.json({ error: createError.message }, 400);
  
  await supabase.from('room_participants').insert([
    { room_id: newRoom.id, user_id: user1_id },
    { room_id: newRoom.id, user_id: user2_id },
  ]);
  
  return c.json({ room_id: newRoom.id });
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(1)}km`;
}

app.post(
  '/messages',
  zValidator(
    'json',
    z.object({
      room_id: z.string(),
      sender_id: z.string(),
      content: z.string(),
      type: z.string().default('text'),
      client_msg_id: z.string().uuid().optional(),
      sender_lat: z.number().optional(),
      sender_lng: z.number().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');
    
    if (!checkRateLimit(body.sender_id)) {
      return c.json({ error: 'Rate limit exceeded. Max 5 messages per 2 seconds.', reason: 'RATE_LIMITED' }, 429);
    }

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('id, type, latitude, longitude, radius')
      .eq('id', body.room_id)
      .single();

    if (roomError || !room) {
      return c.json({ error: 'Room not found', reason: 'ROOM_NOT_FOUND' }, 404);
    }

    if (room.type !== 'private') {
      const { data: participation } = await supabase
        .from('room_participants')
        .select('left_at')
        .eq('room_id', body.room_id)
        .eq('user_id', body.sender_id)
        .single();

      if (participation?.left_at) {
          const hoursSinceLeft = (Date.now() - new Date(participation.left_at).getTime()) / (1000 * 60 * 60);
          
          const { count: msgCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', body.room_id);
          
          const hasMessages = (msgCount ?? 0) > 0;
          
          if (hoursSinceLeft >= 48 && !hasMessages) {
            return c.json({ error: 'This chat has expired (48hrs since you left)', reason: 'EXPIRED' }, 403);
          }
        }

        if (body.sender_lat !== undefined && body.sender_lng !== undefined) {
          const distance = calculateDistance(
            body.sender_lat,
            body.sender_lng,
            room.latitude ?? 0,
            room.longitude ?? 0
          );
        const radius = room.radius || 100;
          if (distance > radius) {
            return c.json({ 
              error: `Out of range. You are ${formatDistance(distance)} away, max is ${formatDistance(radius)}.`,
              reason: 'OUT_OF_RANGE',
              distance: Math.round(distance),
              radius 
            }, 403);
          }
      }
    }
    
    const client_msg_id = body.client_msg_id || randomUUID();
    
      const { data, error } = await supabase
          .from('messages')
          .insert({
            room_id: body.room_id,
            sender_id: body.sender_id,
            content: body.content,
            type: body.type,
            client_msg_id,
          })
          .select('id, client_msg_id, room_id, sender_id, content, type, created_at')
          .single();

        if (error) return c.json({ error: error.message }, 400);

        // Send push notifications to other participants in the room
        // CRITICAL: We AWAIT this block to ensure reliability on platforms like Render
        try {
          console.log(`Push: Handling notifications for room ${body.room_id}, sender ${body.sender_id}`);
          const { data: participants, error: partError } = await supabase
            .from('room_participants')
            .select('user_id')
            .eq('room_id', body.room_id)
            .neq('user_id', body.sender_id)
            .is('left_at', null);

          if (partError) {
            console.error('Push: Error fetching participants:', partError);
          } else if (participants && participants.length > 0) {
            console.log(`Push: Found ${participants.length} participants to notify`);

            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('full_name, username')
              .eq('id', body.sender_id)
              .single();

            const { data: roomInfo } = await supabase
              .from('chat_rooms')
              .select('name, type')
              .eq('id', body.room_id)
              .single();

            const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone';
            const isPrivate = roomInfo?.type === 'private';
            const messagePreview = body.type === 'image' ? '📷 Photo' : body.type === 'gif' ? '🎬 GIF' : body.content.substring(0, 50);

            const title = isPrivate ? senderName : (roomInfo?.name || 'Chat');
            const notifBody = isPrivate ? messagePreview : `${senderName}: ${messagePreview}`;

            console.log(`Push: Constructing notifications for ${participants.length} participants`);

            // Process participants in parallel and AWAIT all of them
            await Promise.all(participants.map(async (participant) => {
              if (participant.user_id) {
                try {
                  console.log(`Push: Sending to user ${participant.user_id}`);
                  
                  // 1. Send Push Notification (Already awaited inside)
                  await sendPushToUser(participant.user_id, title, notifBody, { 
                    type: 'new_message', 
                    room_id: body.room_id,
                    sender_id: body.sender_id
                  });

                  // 2. Insert into notifications table for in-app Activity tab
                  const { error: insertError } = await supabase.from('notifications').insert({
                    user_id: participant.user_id,
                    type: 'new_message',
                    title: title,
                    content: notifBody,
                    data: {
                      room_id: body.room_id,
                      sender_id: body.sender_id
                    }
                  });
                  
                  if (insertError) {
                    console.error(`Push: Error inserting in-app notification for ${participant.user_id}:`, insertError);
                  } else {
                    console.log(`Push: In-app notification created for ${participant.user_id}`);
                  }
                } catch (participantError) {
                  console.error(`Push: Failed for participant ${participant.user_id}:`, participantError);
                }
              }
            }));
          } else {
            console.log('Push: No other active participants to notify');
          }
        } catch (err) {
          console.error('Push: Error in notification block:', err);
        }

        return c.json(data);
    }
  );

// 6. Room Management
app.get('/rooms/user-rooms', async (c) => {
  const userId = c.req.query('userId');
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');

  if (!userId) {
    return c.json({ error: 'userId required' }, 400);
  }

  const { data: participations, error: partError } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', userId);

  if (partError) return c.json({ error: partError.message }, 500);
  if (!participations || participations.length === 0) return c.json([]);

    const roomIds = participations.map(p => p.room_id).filter((id): id is string => id !== null);

  const { data: rooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select(`
      id,
      name,
      type,
      latitude,
      longitude,
      radius,
      expires_at,
      created_at,
      room_participants(
        user_id,
        left_at,
        profiles(id, full_name, username, avatar_url)
      )
    `)
    .in('id', roomIds);

  if (roomsError) return c.json({ error: roomsError.message }, 500);
  if (!rooms) return c.json([]);

  const { data: lastMessages } = await supabase
    .from('messages')
    .select('room_id, content, created_at, type')
    .in('room_id', roomIds)
    .order('created_at', { ascending: false });

  const lastMessageMap = new Map<string, any>();
  if (lastMessages) {
    for (const msg of lastMessages) {
    if (!lastMessageMap.has(msg.room_id ?? '')) {
          lastMessageMap.set(msg.room_id ?? '', msg);
      }
    }
  }

        const enrichedRooms = rooms.map((room: any) => {
          const lastMsg = lastMessageMap.get(room.id);
          let distance: number | null = null;
          let isExpired = false;
          let readOnlyReason: string | null = null;
          let isCurrentlyInZone = false;

          const userParticipation = room.room_participants?.find((p: any) => p.user_id === userId);
          const hasMessages = !!lastMsg;

            if (room.type !== 'private' && lat && lng) {
              distance = calculateDistance(lat, lng, room.latitude, room.longitude);
              const radius = room.radius || 100;
              
              if (distance <= radius) {
                isCurrentlyInZone = true;
              } else {
                const leftAt = userParticipation?.left_at;
                if (leftAt) {
                  const hoursSinceLeft = (Date.now() - new Date(leftAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceLeft >= 48 && !hasMessages) {
                      isExpired = true;
                      readOnlyReason = 'Expired';
                    } else if (!hasMessages) {
                      const hoursRemaining = Math.ceil(48 - hoursSinceLeft);
                      readOnlyReason = `${formatDistance(distance)} away (${hoursRemaining}hr left)`;
                    } else {
                      readOnlyReason = `${formatDistance(distance)} away`;
                    }
                  } else {
                    readOnlyReason = `${formatDistance(distance)} away`;
                  }
              }
            }

        let displayName = room.name;
        let otherUserAvatar: string | null = null;
        let otherUserId: string | null = null;

        if (room.type === 'private') {
          const otherParticipant = room.room_participants?.find(
            (p: any) => p.user_id !== userId
          );
          const profile = otherParticipant?.profiles;
          if (profile) {
            displayName = profile.full_name || `@${profile.username}` || 'Private Chat';
            otherUserAvatar = profile.avatar_url;
            otherUserId = profile.id;
          }
        }

        return {
          id: room.id,
          name: displayName,
          type: room.type,
          latitude: room.latitude,
          longitude: room.longitude,
          radius: room.radius,
          expires_at: room.expires_at,
          created_at: room.created_at,
          other_user_avatar: otherUserAvatar,
          other_user_id: otherUserId,
          last_message_at: lastMsg?.created_at || null,
        last_message_preview: lastMsg ? (lastMsg.type === 'text' ? lastMsg.content.substring(0, 50) : `[${lastMsg.type}]`) : null,
        distance: distance !== null ? Math.round(distance) : null,
        is_expired: isExpired,
        read_only_reason: readOnlyReason,
        is_currently_in_zone: isCurrentlyInZone,
      };
    });

  enrichedRooms.sort((a, b) => {
    const aTime = a.last_message_at || a.created_at || '';
    const bTime = b.last_message_at || b.created_at || '';
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return c.json(enrichedRooms);
});

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
    .upsert({ 
      room_id: roomId, 
      user_id: userId,
      left_at: null,
      joined_at: new Date().toISOString()
    }, { onConflict: 'room_id,user_id' })
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
    .update({ left_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true });
});

// 6b. Create Room (checks for existing nearby room first with race condition protection)
const roomCreationLocks = new Map<string, Promise<any>>();

app.post('/rooms/create', async (c) => {
  const { name, latitude, longitude, radius, userId } = await c.req.json();
  
  const lockKey = `${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
  
  const existingLock = roomCreationLocks.get(lockKey);
  if (existingLock) {
    try {
      const existingResult = await existingLock;
      if (existingResult?.room && userId) {
        await supabase.from('room_participants').upsert({
          room_id: existingResult.room.id,
          user_id: userId,
        }, { onConflict: 'room_id,user_id' });
      }
      return c.json({ room: existingResult?.room, existing: true });
    } catch {}
  }
  
  const createRoomPromise = (async () => {
    try {
      const { data: existingRooms } = await supabase.rpc('find_nearby_rooms', {
        lat: latitude,
        lng: longitude,
        max_dist_meters: 300,
      });

      if (existingRooms && existingRooms.length > 0) {
        const existingRoom = existingRooms[0];
        
        if (userId) {
          await supabase.from('room_participants').upsert({
            room_id: existingRoom.id,
            user_id: userId,
          }, { onConflict: 'room_id,user_id' });
        }

        return { room: existingRoom, existing: true };
      }

      const { data: room, error } = await supabase
          .from('chat_rooms')
          .insert({
            name,
            type: 'public',
            latitude,
            longitude,
            radius: radius || 500,
          })
          .select()
          .single();

      if (error) {
        const { data: retryRooms } = await supabase.rpc('find_nearby_rooms', {
          lat: latitude,
          lng: longitude,
          max_dist_meters: 300,
        });
        if (retryRooms && retryRooms.length > 0) {
          if (userId) {
            await supabase.from('room_participants').upsert({
              room_id: retryRooms[0].id,
              user_id: userId,
            }, { onConflict: 'room_id,user_id' });
          }
          return { room: retryRooms[0], existing: true };
        }
        throw error;
      }

      if (userId) {
        await supabase.from('room_participants').insert({
          room_id: room.id,
          user_id: userId,
        });
      }

      return { room, existing: false };
    } finally {
      setTimeout(() => roomCreationLocks.delete(lockKey), 2000);
    }
  })();
  
  roomCreationLocks.set(lockKey, createRoomPromise);
  
  try {
    const result = await createRoomPromise;
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
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

app.post('/notifications/read', async (c) => {
  const { notificationIds } = await c.req.json();
  
  if (!notificationIds || !Array.isArray(notificationIds)) {
    return c.json({ error: 'notificationIds array required' }, 400);
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true, updated: notificationIds.length });
});

app.delete('/notifications/:id', async (c) => {
  const id = c.req.param('id');
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true });
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

  const friends = data.map((f: any) => (f.user_id_1 === userId ? f.user_2 : f.user_1));
  return c.json(friends);
});

app.post('/friends/request', async (c) => {
  const { sender_id, receiver_id } = await c.req.json();

  const { data: existingFriend } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id_1.eq.${sender_id},user_id_2.eq.${receiver_id}),and(user_id_1.eq.${receiver_id},user_id_2.eq.${sender_id})`)
    .single();

  if (existingFriend) {
    return c.json({ error: 'You are already friends with this user' }, 400);
  }

  const sortedIds = [sender_id, receiver_id].sort();
  const privateRoomName = `private_${sortedIds[0]}_${sortedIds[1]}`;
  const { data: hasPrivateRoom } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('type', 'private')
    .eq('name', privateRoomName)
    .single();

  if (hasPrivateRoom) {
    return c.json({ error: 'You are already connected with this user' }, 400);
  }

  const { data: existingRequest } = await supabase
    .from('friend_requests')
    .select('id')
    .or(`and(sender_id.eq.${sender_id},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${sender_id})`)
    .eq('status', 'pending')
    .single();

  if (existingRequest) {
    return c.json({ error: 'A friend request already exists' }, 400);
  }

  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id, receiver_id, status: 'pending' })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  await supabase.from('notifications').insert({
    user_id: receiver_id,
    type: 'friend_request',
    title: 'New Friend Request',
    content: 'You have a new friend request!',
  });

  const { data: senderProfile2 } = await supabase.from('profiles').select('full_name, username').eq('id', sender_id).single();
  const senderName2 = senderProfile2?.full_name || senderProfile2?.username || 'Someone';
  sendPushToUser(receiver_id, 'New Friend Request', `${senderName2} wants to connect with you!`, { type: 'friend_request' });

  return c.json(data);
});

app.get('/tapins/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const { data, error } = await supabase
    .from('tapins')
    .select(`
      *,
      sender:profiles!sender_id(id, username, full_name, avatar_url)
    `)
    .eq('receiver_id', userId)
    .is('viewed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post(
  '/tapins',
  zValidator(
    'json',
    z.object({
      sender_id: z.string().uuid(),
      receiver_id: z.string().uuid(),
      image_url: z.string().url(),
      caption: z.string().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const { data, error } = await supabase
      .from('tapins')
      .insert({
        sender_id: body.sender_id,
        receiver_id: body.receiver_id,
        image_url: body.image_url,
        caption: body.caption || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 400);

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', body.sender_id)
      .single();
    
    const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone';
    sendPushToUser(body.receiver_id, 'New Photo!', `${senderName} sent you a photo`, { type: 'tapin', tapin_id: data.id });

    return c.json(data);
  }
);

app.patch('/tapins/:id/view', async (c) => {
  const id = c.req.param('id');
  
  const { data, error } = await supabase
    .from('tapins')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

app.delete('/tapins/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.query('userId');
  
  const { error } = await supabase
    .from('tapins')
    .delete()
    .eq('id', id)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true });
});

// 11. Auth Welcome Email
app.post('/auth/welcome', async (c) => {
  const { email, name } = await c.req.json();

  if (!email) {
    return c.json({ error: 'Email required' }, 400);
  }

  try {
    const data = await resend.emails.send({
      from: 'TapIn <welcome@tapin.pro>',
      to: [email],
      subject: 'Welcome to TapIn!',
      html: `
        <h1>Welcome${name ? `, ${name}` : ''}!</h1>
        <p>Thanks for joining TapIn. Start discovering people and conversations near you.</p>
      `,
    });
    return c.json(data);
  } catch (err: any) {
    console.error('Welcome email error:', err);
    return c.json({ success: true });
  }
});

app.delete('/auth/delete-account', async (c) => {
  const { userId } = await c.req.json();
  
  if (!userId) {
    return c.json({ error: 'userId required' }, 400);
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// 12. Push Tokens (for push notifications)
app.post(
  '/push-tokens',
  zValidator(
    'json',
    z.object({
      user_id: z.string().uuid(),
      token: z.string(),
      platform: z.enum(['ios', 'android', 'web']),
    })
  ),
  async (c) => {
    const body = c.req.valid('json');

    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: body.user_id,
          token: body.token,
          platform: body.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      )
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 400);

    // Automatically enable push notifications for the user if we successfully registered a token
    // This ensures notifications work after the user grants OS-level permissions
    await supabase
      .from('profiles')
      .update({ push_notifications_enabled: true })
      .eq('id', body.user_id);

    return c.json(data);
  }
);

app.delete('/push-tokens', async (c) => {
  const { user_id, token } = await c.req.json();

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', user_id)
    .eq('token', token);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true });
});

app.get('/push-tokens/:userId', async (c) => {
  const userId = c.req.param('userId');

  const { data, error } = await supabase
    .from('push_tokens')
    .select('*')
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

    app.post(
      '/push/send',
      zValidator(
        'json',
        z.object({
          user_ids: z.array(z.string().uuid()),
          title: z.string(),
          body: z.string(),
          data: z.record(z.any()).optional(),
        })
      ),
      async (c) => {
        const { user_ids, title, body, data: notificationData } = c.req.valid('json');
        console.log(`Debug: Manual push request for users: ${user_ids.join(', ')}`);

        const results = await Promise.all(user_ids.map(async (uid) => {
          await sendPushToUser(uid, title, body, notificationData);
          return { user_id: uid, status: 'processed' };
        }));

        return c.json({ success: true, results });
      }
    );

    app.get('/debug/push/:userId', async (c) => {
      const userId = c.req.param('userId');
      console.log(`Debug: Triggering test push for user ${userId}`);
      await sendPushToUser(userId, 'Test Notification', 'If you see this, push notifications are working!');
      return c.json({ success: true, message: `Push triggered for ${userId}. Check backend logs for Expo response.` });
    });

async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, any>) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_notifications_enabled')
      .eq('id', userId)
      .single();

    if (!profile?.push_notifications_enabled) {
      console.log('Push: Notifications disabled for user', userId);
      return;
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokenError) {
      console.error('Push: Error fetching tokens for user', userId, tokenError);
      return;
    }

    if (!tokens || tokens.length === 0) {
      console.log('Push: No tokens found for user', userId);
      return;
    }

    console.log(`Push: Sending to ${tokens.length} device(s) for user ${userId}`);

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title,
      body,
      data: data || {},
      priority: 'high' as const,
      channelId: 'default',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('Push: Expo response:', JSON.stringify(result));
    
    if (result.data) {
      result.data.forEach((r: any, i: number) => {
        if (r.status === 'error') {
          console.error('Push: Error sending to token', tokens[i].token, r.message);
        }
      });
    }
  } catch (err) {
    console.error('Push notification error:', err);
  }
}

const port = Number(process.env.PORT) || 3003;

const isBun = typeof process !== 'undefined' && (process as any).isBun === true;

if (!isBun) {
  serve({
    fetch: app.fetch,
    port,
  });
  console.log(`Server is running on port ${port} (Node.js)`);
} else {
  console.log(`Server is running on port ${port} (Bun)`);
}

export default {
  port,
  fetch: app.fetch,
};
