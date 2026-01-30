import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
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

function getEmailHtml(fullName: string, verificationLink: string, isWelcome: boolean) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email for TapIn</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 40px;">
      <div style="display: inline-block; width: 60px; height: 60px; background-color: #000; border-radius: 18px; color: #fff; font-size: 32px; line-height: 60px; font-weight: 900; text-align: center; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">T</div>
      <h1 style="font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -1.5px; color: #000;">TapIn</h1>
    </div>
    <div style="background-color: #ffffff; border: 1.5px solid #000000; border-radius: 32px; padding: 48px 32px; text-align: center; box-shadow: 8px 8px 0px #000000;">
      <h2 style="font-size: 28px; font-weight: 900; margin: 0 0 16px 0; color: #000; letter-spacing: -0.5px;">
        ${isWelcome ? `Welcome, ${fullName}!` : `Welcome Back!`}
      </h2>
      <p style="font-size: 17px; line-height: 1.6; color: #333; margin: 0 0 32px 0; font-weight: 500;">
        ${isWelcome 
          ? "We're thrilled to have you join our community. TapIn is all about connecting with people and conversations happening right around you."
          : "Please verify your email to jump back into the conversations happening around you."}
      </p>
      <a href="${verificationLink}" style="display: inline-block; background-color: #000; color: #ffffff; padding: 20px 48px; border-radius: 24px; text-decoration: none; font-weight: 800; font-size: 18px; transition: all 0.2s ease;">
        Verify Your Email
      </a>
      <div style="margin-top: 48px; padding-top: 32px; border-top: 1px solid #eeeeee; text-align: left;">
        <p style="font-size: 13px; color: #888; margin: 0 0 12px 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
          Direct Link
        </p>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 12px; word-break: break-all;">
          <a href="${verificationLink}" style="font-size: 12px; line-height: 1.5; color: #666; text-decoration: none; font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;">
            ${verificationLink}
          </a>
        </div>
      </div>
    </div>
    <div style="margin-top: 32px; padding: 24px; background-color: #000; border-radius: 24px; color: #fff;">
      <p style="margin: 0; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 8px;">Quick Tip</p>
      <p style="margin: 0; font-size: 15px; color: #fff; line-height: 1.5; font-weight: 500;">Enable location services in the app to discover rooms and see people nearby!</p>
    </div>
    <div style="text-align: center; margin-top: 48px;">
      <p style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 800;">
        TapIn • Connect Locally
      </p>
      <p style="font-size: 11px; color: #bbb; margin-top: 8px; font-weight: 500;">
        &copy; 2026 TapIn. All rights reserved.<br/>
        You're receiving this because you signed up for TapIn.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendVerificationEmail(email: string, fullName: string, type: 'signup' | 'welcome' = 'signup', userId?: string) {
  let baseUrl = process.env.BACKEND_URL || 
                process.env.RENDER_EXTERNAL_URL || 
                (process.env.AUTH_REDIRECT_URL ? process.env.AUTH_REDIRECT_URL.replace('/auth/callback', '') : 'https://tap-in-backend.onrender.com');
  
  if (process.env.NODE_ENV !== 'production' && process.env.NGROK_URL) {
    baseUrl = process.env.NGROK_URL;
  }
  
  const redirectTo = `${baseUrl}/auth/callback`;
  console.log(`Email Service: Processing ${type} email for ${email} (UserID: ${userId || 'unknown'})`);
  
  let verificationLink = `${baseUrl}/auth/welcome?email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}`;
  let isAlreadyVerified = false;
  let user: any = null;

  if (type === 'signup') {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      options: { redirectTo },
    });

    if (linkError) {
      console.error('Error generating signup link:', linkError);
      throw linkError;
    }
    verificationLink = linkData.properties.action_link;
  } else if (type === 'welcome') {
    if (userId) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      user = userData.user;
    } else {
      const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const searchEmail = email.toLowerCase().trim();
      user = allUsers.find(u => {
        const authEmail = u.email?.toLowerCase();
        const realEmail = u.user_metadata?.real_email?.toLowerCase();
        return authEmail === searchEmail || realEmail === searchEmail;
      });
    }
  
    if (user) {
      if (!user.email_confirmed_at) {
        console.log(`User ${email} is not confirmed, upgrading welcome email to signup link`);
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'signup',
          email: user.email!,
          options: { redirectTo },
        });
        if (!linkError) verificationLink = linkData.properties.action_link;
      } else {
        isAlreadyVerified = true;
        console.log(`User ${email} is already confirmed, sending welcome link`);
      }
    }
  }

    const isWelcome = type === 'welcome';
    const buttonText = (isAlreadyVerified || type === 'welcome') ? 'Explore TapIn' : 'Verify Your Email';
    const subject = isWelcome 
      ? (isAlreadyVerified ? `Welcome back to TapIn, ${fullName}!` : `Verify your account, ${fullName}!`)
      : 'Verify your email for TapIn!';

    try {
      // Use magic link for already verified users to provide one-click login
      if (isAlreadyVerified && user) {
        const { data: magicData, error: magicError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: user.email!,
          options: { redirectTo },
        });
        if (!magicError) verificationLink = magicData.properties.action_link;
      }

      const htmlContent = getEmailHtml(fullName, verificationLink, isWelcome).replace('Verify Your Email', buttonText);
      
      console.log('Attempting to send email via Resend...', {
        from: 'TapIn <team@securim.ca>',
        to: email,
        subject
      });
      
      const { data, error } = await resend.emails.send({
        from: 'TapIn <team@securim.ca>',
        to: [email],
        subject,
        html: htmlContent,
      });
    
    if (error) {
      console.error('Resend API Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Email sent successfully! ID:', data?.id);
    }
    return { data, error };
  } catch (err) {
    console.error('Unexpected email error:', err);
    return { data: null, error: err };
  }
}

const messageRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 2000;
const RATE_LIMIT_MAX_MESSAGES = 5;

function checkRateLimit(senderId: string): boolean {
  const now = Date.now();
  const timestamps = messageRateLimit.get(senderId) || [];
  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) return false;
  recentTimestamps.push(now);
  messageRateLimit.set(senderId, recentTimestamps);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of messageRateLimit.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) messageRateLimit.delete(key);
    else messageRateLimit.set(key, recent);
  }
}, 10000);

const app = new Hono();
app.use('*', cors());

app.use('*', async (c, next) => {
  const publicPaths = ['/health', '/', '/auth/callback', '/auth/welcome', '/auth/signup', '/auth/verify'];
  if (publicPaths.includes(c.req.path)) return await next();

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return await next();

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (!error && user) c.set('user', user);
  await next();
});

// --- HELPERS ---
async function ensureFriendship(userId1: string, userId2: string) {
  const sorted = [userId1, userId2].sort();
  const { error } = await supabase.from('friends').upsert({ user_id_1: sorted[0], user_id_2: sorted[1] }, { onConflict: 'user_id_1,user_id_2' });
  return !error;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function enrichProfiles(profiles: any[], userId: string | undefined | null) {
  if (!userId || profiles.length === 0) return profiles;
  const { data: friends } = await supabase.from('friends').select('user_id_1, user_id_2').or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);
  const { data: pendingRequests } = await supabase.from('friend_requests').select('sender_id, receiver_id').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'pending');
  const { data: privateRooms } = await supabase.from('chat_rooms').select('name').eq('type', 'private').like('name', `%${userId}%`);
  
  const friendIds = new Set(friends?.map(f => f.user_id_1 === userId ? f.user_id_2 : f.user_id_1));
  const pendingIds = new Set(pendingRequests?.map(r => r.sender_id === userId ? r.receiver_id : r.sender_id));
  const privateRoomUserIds = new Set(privateRooms?.map(r => {
    const parts = r.name.replace('private_', '').split('_');
    return parts[0] === userId ? parts[1] : parts[0];
  }));
  
  return profiles.map(u => ({
    ...u,
    connection_status: friendIds.has(u.id) || privateRoomUserIds.has(u.id) ? 'accepted' : pendingIds.has(u.id) ? 'pending' : 'none',
    has_private_room: privateRoomUserIds.has(u.id)
  }));
}

// --- ROUTES ---
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.3', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' }));
app.get('/', (c) => c.text('Tap In API v1.0.3 is Running'));

app.get('/profiles/nearby', async (c) => {
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const radius = parseInt(c.req.query('radius') || '5000');
  const userId = c.req.query('userId');

  const lat = parseFloat(latStr || '0');
  const lng = parseFloat(lngStr || '0');
  
  // Validation to prevent "could not find function" errors in Supabase RPC
  if (isNaN(lat) || isNaN(lng) || !latStr || !lngStr) {
    return c.json({ error: 'Valid latitude and longitude are required' }, 400);
  }
  
  // Ensure userId is a valid UUID string or null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validUserId = userId && uuidRegex.test(userId) ? userId : null;

  const { data, error } = await supabase.rpc('find_nearby_users', { 
    lat, 
    lng, 
    max_dist_meters: radius, 
    exclude_id: validUserId 
  });
  
  if (error) {
    console.error('RPC Error (find_nearby_users):', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json(await enrichProfiles(data || [], userId));
});

app.get('/profiles/search', async (c) => {
  const q = c.req.query('q') || '';
  const userId = c.req.query('userId');
  const { data, error } = await supabase.from('profiles').select('*').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).eq('is_incognito', false).order('last_seen', { ascending: false }).limit(20);
  if (error) return c.json({ error: error.message }, 500);
  return c.json(await enrichProfiles(data || [], userId));
});

app.get('/profiles/:id', async (c) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', c.req.param('id')).single();
  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

app.post('/rooms/sync', zValidator('json', z.object({ userId: z.string(), latitude: z.number(), longitude: z.number(), address: z.string().optional() })), async (c) => {
  const { userId, latitude, longitude, address } = c.req.valid('json');
  try {
    await supabase.rpc('cleanup_expired_rooms');
    
    // 1. Update user coordinate data and last_seen
    // We update location_name if it looks like an address or is empty
    const { data: currentProfile } = await supabase.from('profiles').select('location_name').eq('id', userId).single();
    
    const profileUpdates: any = { 
      latitude, 
      longitude, 
      last_seen: new Date().toISOString() 
    };
    
    // Improved logic: If we have a new address, update it UNLESS the user has set
    // a truly custom name (one that doesn't look like an address)
    const isAutoGenerated = !currentProfile?.location_name || 
                            currentProfile.location_name === 'Nearby Zone' ||
                            currentProfile.location_name.match(/\d+.*(Rd|St|Ave|Dr|Way|Blvd|Ln|Ct|Pl)/i) ||
                            currentProfile.location_name.includes(',') ||
                            currentProfile.location_name === 'Unnamed Road';

    if (address && isAutoGenerated) {
      profileUpdates.location_name = address;
    }

    await supabase.from('profiles').update(profileUpdates).eq('id', userId);
    
    // 2. Find rooms within 1000m
    const { data: existingRooms } = await supabase.rpc('find_nearby_rooms', { 
      lat: latitude, 
      lng: longitude, 
      max_dist_meters: 1000 
    });
      const publicRooms = (existingRooms || []).filter((r: any) => r.type === 'public');
      
      if (publicRooms.length > 0) {
        const nearestRoom = publicRooms.sort((a: any, b: any) => calculateDistance(latitude, longitude, a.latitude, a.longitude) - calculateDistance(latitude, longitude, b.latitude, b.longitude))[0];
        await supabase.from('room_participants').upsert({ room_id: nearestRoom.id, user_id: userId, left_at: null }, { onConflict: 'room_id,user_id' });
        return c.json({ joinedRoomIds: [nearestRoom.id], activeRoomIds: publicRooms.map((r: any) => r.id), serverTime: new Date().toISOString() });
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create a more descriptive name for the auto-generated zone
      let roomName = address || 'Nearby Zone';
      if (roomName === 'Unnamed Road' || !roomName) {
        roomName = 'Nearby Zone';
      }

      const { data: newRoom } = await supabase.from('chat_rooms').insert({ 
        name: roomName, 
        type: 'public', 
        latitude, 
        longitude, 
        radius: 1000,
        expires_at: expiresAt.toISOString()
      }).select().single();

    if (newRoom) await supabase.from('room_participants').insert({ room_id: newRoom.id, user_id: userId });
    return c.json({ joinedRoomIds: newRoom ? [newRoom.id] : [], activeRoomIds: newRoom ? [newRoom.id] : [], serverTime: new Date().toISOString() });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/rooms/nearby', async (c) => {
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const radius = parseInt(c.req.query('radius') || '1000');
  
  const lat = parseFloat(latStr || '0');
  const lng = parseFloat(lngStr || '0');

  // Validation to prevent "could not find function" errors in Supabase RPC
  if (isNaN(lat) || isNaN(lng) || !latStr || !lngStr) {
    return c.json({ error: 'Valid latitude and longitude are required' }, 400);
  }
  
  const { data, error } = await supabase.rpc('find_nearby_rooms', { 
    lat, 
    lng, 
    max_dist_meters: radius 
  });
  
  if (error) {
    console.error('RPC Error (find_nearby_rooms):', error);
    return c.json({ error: error.message }, 500);
  }
  
  return c.json((data || []).filter((r: any) => r.type === 'public'));
});

app.post('/rooms/create', zValidator('json', z.object({ 
  name: z.string(), 
  latitude: z.number(), 
  longitude: z.number(), 
  radius: z.number().default(500),
  userId: z.string()
})), async (c) => {
  const { name, latitude, longitude, radius, userId } = c.req.valid('json');
  
  try {
    // 1. Update user location first
    await supabase.from('profiles').update({ 
      latitude, 
      longitude, 
      last_seen: new Date().toISOString() 
    }).eq('id', userId);

    // 2. Check for existing public rooms very close (within 50m) to avoid duplicates
    const { data: existing } = await supabase.rpc('find_nearby_rooms', { 
      lat: latitude, 
      lng: longitude, 
      max_dist_meters: 50 
    });

    const existingPublic = (existing || []).find((r: any) => r.type === 'public');
    if (existingPublic) {
      // Join existing instead
      await supabase.from('room_participants').upsert({ 
        room_id: existingPublic.id, 
        user_id: userId,
        left_at: null 
      }, { onConflict: 'room_id,user_id' });
      
      return c.json({ room: existingPublic, joined: true });
    }

    // 3. Create new room with 24h expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert({
        name,
        type: 'public',
        latitude,
        longitude,
        radius,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // 4. Join the room
    await supabase.from('room_participants').insert({
      room_id: room.id,
      user_id: userId
    });

    return c.json({ room, joined: true });
  } catch (err: any) {
    console.error('Error creating room:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.get('/rooms/user-rooms', async (c) => {
  const userId = c.req.query('userId');
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  
  // Ensure userId is a valid UUID string
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !uuidRegex.test(userId)) {
    return c.json({ error: 'Invalid user ID' }, 400);
  }

  const { data: rooms, error } = await supabase.rpc('get_user_rooms_v3', { 
    p_user_id: userId, 
    p_lat: lat, 
    p_lng: lng 
  });
  
  if (error) {
    console.error('RPC Error (get_user_rooms_v3):', error);
    return c.json({ error: error.message }, 500);
  }
  return c.json((rooms || []).map((room: any) => ({
    id: room.id,
    name: room.type === 'private' ? (room.other_user_full_name || `@${room.other_user_username}` || 'Private Chat') : room.name,
    type: room.type, distance: room.distance !== null ? Math.round(room.distance) : null,
    last_message_at: room.last_message_created_at || null,
    last_message_preview: room.last_message_content ? room.last_message_content.substring(0, 50) : null
  })));
});

app.post('/messages', zValidator('json', z.object({ 
  room_id: z.string(), 
  sender_id: z.string(), 
  content: z.string(), 
  type: z.string().default('text'),
  sender_lat: z.number().optional(),
  sender_lng: z.number().optional()
})), async (c) => {
  const body = c.req.valid('json');
  if (!checkRateLimit(body.sender_id)) return c.json({ error: 'Rate limit exceeded' }, 429);
  
  // 1. Proximity Enforcement for Public Rooms
  const { data: room } = await supabase.from('chat_rooms').select('type, latitude, longitude, radius, expires_at').eq('id', body.room_id).single();
  
  if (!room) return c.json({ error: 'Room not found' }, 404);

  // Check expiration
  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    return c.json({ error: 'Chat has expired' }, 403);
  }

  // Check proximity for public/auto-generated rooms
  if (room.type !== 'private' && body.sender_lat != null && body.sender_lng != null) {
    const distance = calculateDistance(body.sender_lat, body.sender_lng, room.latitude!, room.longitude!);
    const radius = room.radius || 1000;
    
    // We allow a 5km grace radius for users who are already in the room
    const graceRadius = 5000;
    if (distance > graceRadius) {
      return c.json({ 
        error: 'Out of range', 
        message: `You are too far from this location (${Math.round(distance)}m). Max allowed: ${graceRadius}m.` 
      }, 403);
    }
  }
  
  const { data, error } = await supabase.from('messages').insert({ 
    room_id: body.room_id, 
    sender_id: body.sender_id, 
    content: body.content, 
    type: body.type 
  }).select().single();
  
  if (error) return c.json({ error: error.message }, 400);

  // Background: Handle Push Notifications
  (async () => {
    try {
      // 1. Get sender info
      const { data: sender } = await supabase.from('profiles').select('full_name, username').eq('id', body.sender_id).single();

      if (!sender) return;

      // 2. Get all other participants in the room
      const { data: participants } = await supabase
        .from('room_participants')
        .select('user_id, profiles(active_room_id, full_name)')
        .eq('room_id', body.room_id)
        .neq('user_id', body.sender_id);

      if (!participants || participants.length === 0) return;

      const senderName = sender.full_name || `@${sender.username}`;
      const notificationTitle = room?.type === 'private' ? senderName : (room?.name || 'New Message');
      const notificationBody = body.type === 'image' ? `${senderName} sent a photo` : 
                               body.type === 'gif' ? `${senderName} sent a GIF` : 
                               room?.type === 'private' ? body.content : `${senderName}: ${body.content}`;

      // 3. Send to those not currently in this chat room
      for (const p of participants) {
        const profile = p.profiles as any;
        if (profile?.active_room_id !== body.room_id) {
          await sendPushToUser(p.user_id, notificationTitle, notificationBody, { 
            room_id: body.room_id,
            type: 'chat_message'
          });
        }
      }
    } catch (err) {
      console.error('Error in background push notification logic:', err);
    }
  })();

  return c.json(data);
});

app.get('/messages/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const limit = parseInt(c.req.query('limit') || '50');
  const cursor = c.req.query('cursor');
  const since = c.req.query('since');

  let query = supabase
    .from('messages')
    .select('*, sender:profiles(id, username, full_name, avatar_url)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }
  if (since) {
    query = query.gt('created_at', since);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const hasMore = (data || []).length === limit;
  const nextCursor = hasMore ? data[data.length - 1].created_at : null;

  return c.json({
    messages: data || [],
    nextCursor,
    hasMore
  });
});

app.post('/rooms/private', zValidator('json', z.object({ user1_id: z.string(), user2_id: z.string() })), async (c) => {
  const { user1_id, user2_id } = c.req.valid('json');
  const sortedIds = [user1_id, user2_id].sort();
  const roomName = `private_${sortedIds[0]}_${sortedIds[1]}`;

  // 1. Check if room exists
  const { data: existingRoom } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('name', roomName)
    .eq('type', 'private')
    .maybeSingle();

  if (existingRoom) {
    return c.json({ room_id: existingRoom.id });
  }

  // 2. Create room
  const { data: newRoom, error: roomError } = await supabase
    .from('chat_rooms')
    .insert({ name: roomName, type: 'private' })
    .select()
    .single();

  if (roomError) return c.json({ error: roomError.message }, 500);

  // 3. Add participants
  await supabase.from('room_participants').insert([
    { room_id: newRoom.id, user_id: user1_id },
    { room_id: newRoom.id, user_id: user2_id }
  ]);

  return c.json({ room_id: newRoom.id });
});

app.post('/rooms/:id/join', zValidator('json', z.object({ userId: z.string() })), async (c) => {
  const roomId = c.req.param('id');
  const { userId } = c.req.valid('json');
  
  const { error } = await supabase
    .from('room_participants')
    .upsert({ room_id: roomId, user_id: userId, left_at: null }, { onConflict: 'room_id,user_id' });
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

app.get('/friends/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('friends')
    .select('user_id_1, user_id_2')
    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

  if (error) return c.json({ error: error.message }, 500);

  const friendIds = (data || []).map(f => f.user_id_1 === userId ? f.user_id_2 : f.user_id_1);
  if (friendIds.length === 0) return c.json([]);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', friendIds);

  if (profileError) return c.json({ error: profileError.message }, 500);
  return c.json(profiles || []);
});

app.get('/friend-requests/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

app.post('/friends/request', zValidator('json', z.object({ sender_id: z.string(), receiver_id: z.string() })), async (c) => {
  const { sender_id, receiver_id } = c.req.valid('json');

  // Check if they are already friends
  const sorted = [sender_id, receiver_id].sort();
  const { data: existingFriend } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id_1', sorted[0])
    .eq('user_id_2', sorted[1])
    .maybeSingle();

  if (existingFriend) return c.json({ error: 'You are already friends' }, 400);

  // Check if request already exists
  const { data: existingRequest } = await supabase
    .from('friend_requests')
    .select('id, status, sender_id')
    .or(`and(sender_id.eq.${sender_id},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${sender_id})`)
    .maybeSingle();

  if (existingRequest) {
    if (existingRequest.status === 'accepted') return c.json({ error: 'Already friends' }, 400);
    if (existingRequest.sender_id === sender_id) return c.json({ error: 'Request already sent' }, 400);
    
    // If the other person already sent a request, accept it automatically
    await Promise.all([
      supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', existingRequest.id),
      ensureFriendship(sender_id, receiver_id)
    ]);
    return c.json({ success: true, status: 'accepted' });
  }

  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id, receiver_id, status: 'pending' });

  if (error) return c.json({ error: error.message }, 500);

  // Send push notification
  const { data: sender } = await supabase.from('profiles').select('full_name, username').eq('id', sender_id).single();
  if (sender) {
    await sendPushToUser(receiver_id, 'New Connection Request', `${sender.full_name || `@${sender.username}`} wants to connect with you!`, { type: 'friend_request' });
  }

  return c.json({ success: true, status: 'pending' });
});

app.post('/friends/accept', zValidator('json', z.object({ userId: z.string(), requesterId: z.string() })), async (c) => {
  const { userId, requesterId } = c.req.valid('json');
  
  const { data: request, error: fetchError } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('sender_id', requesterId)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (fetchError || !request) return c.json({ error: 'Request not found' }, 404);

  const success = await ensureFriendship(userId, requesterId);
  if (!success) return c.json({ error: 'Failed to accept' }, 500);

  await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id);
  
  return c.json({ success: true });
});

app.get('/auth/callback', async (c) => {
  return c.html(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verifying - TapIn</title></head><body><script>const p = new URLSearchParams(window.location.search); const h = new URLSearchParams(window.location.hash.substring(1)); const s = new URLSearchParams(); [p, h].forEach(x => x.forEach((v, k) => s.append(k, v))); window.location.href = "tapin://auth/callback?" + s.toString();</script></body></html>`);
});

app.get('/auth/welcome', async (c) => {
  const email = c.req.query('email');
  const name = c.req.query('name') || 'Friend';
  return c.html(`<!DOCTYPE html><html><body><h1>Welcome, ${name}!</h1><p>Email ${email} verified.</p><a href="tapin://auth/login">Back to App</a></body></html>`);
});

    app.post('/auth/resend-verification', zValidator('json', z.object({ email: z.string().trim().email() })), async (c) => {
      const { email } = c.req.valid('json');
    try {
      // Find the user in Auth
      const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const searchEmail = email.toLowerCase().trim();
      const user = allUsers.find(u => {
        const authEmail = u.email?.toLowerCase();
        const realEmail = u.user_metadata?.real_email?.toLowerCase();
        return authEmail === searchEmail || realEmail === searchEmail;
      });

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      const fullName = user.user_metadata?.full_name || 'Friend';
      await sendVerificationEmail(email, fullName, 'welcome', user.id);
      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

    app.post('/auth/signup', zValidator('json', z.object({ 
      email: z.string().trim().email(), 
      password: z.string().min(6), 
      full_name: z.string(), 
      username: z.string().regex(/^[a-zA-Z0-9._]+$/, 'Username can only contain letters, numbers, dots, and underscores') 
    })), async (c) => {
    const { email: realEmail, password, full_name, username } = c.req.valid('json');
    
    // Check if username already exists in profiles
    const { data: existingUsername } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .maybeSingle();
      
    if (existingUsername) {
      return c.json({ error: 'This username is already taken. Please try another one.' }, 400);
    }

    // Check if email already exists in profiles
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('email')
      .ilike('email', realEmail)
      .maybeSingle();
      
    if (existingEmail) {
      return c.json({ error: 'This email is already registered. Please log in instead.' }, 400);
    }

    const authEmail = `${username.toLowerCase()}@tapin.internal`;
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({ 
      email: authEmail, 
      password, 
      email_confirm: true, 
      user_metadata: { full_name, username, real_email: realEmail } 
    });
    
    if (userError) {
      if (userError.message.includes('already registered')) {
        return c.json({ error: 'This username is already taken.' }, 400);
      }
      return c.json({ error: userError.message }, 400);
    }

    // Double-ensure the user is confirmed (Supabase bug mitigation)
    await supabase.auth.admin.updateUserById(userData.user.id, { email_confirm: true });
    
    await supabase.from('profiles').upsert({ 
      id: userData.user.id, 
      full_name, 
      username, 
      email: realEmail 
    }, { onConflict: 'id' });
    
    await sendVerificationEmail(realEmail, full_name, 'welcome', userData.user.id);
    return c.json({ success: true, userId: userData.user.id });
  });

async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, any>) {
  try {
    const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
    if (!tokens || tokens.length === 0) return;
    const messages = tokens.map((t) => ({ to: t.token, title, body, data: data || {}, sound: 'default' }));
    await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messages) });
  } catch (err) { console.error('Push Error:', err); }
}

const port = Number(process.env.PORT) || 3003;

// Check if running in Bun or Node.js
// @ts-ignore
if (typeof Bun === 'undefined') {
  console.log(`Node.js detected. Starting Hono server on port ${port}...`);
  serve({
    fetch: app.fetch,
    port,
  });
} else {
  console.log(`Bun detected. Exporting app config for port ${port}...`);
}

export default {
  port,
  fetch: app.fetch,
};