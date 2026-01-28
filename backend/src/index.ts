import { Hono } from 'hono';
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

async function sendVerificationEmail(email: string, fullName: string, type: 'signup' | 'welcome' = 'signup') {
  let baseUrl = process.env.BACKEND_URL || 
                process.env.RENDER_EXTERNAL_URL || 
                (process.env.AUTH_REDIRECT_URL ? process.env.AUTH_REDIRECT_URL.replace('/auth/callback', '') : 'https://tap-in-backend.onrender.com');
  
  if (process.env.NODE_ENV !== 'production' && process.env.NGROK_URL) {
    baseUrl = process.env.NGROK_URL;
  }
  
  const redirectTo = `${baseUrl}/auth/callback`;
  console.log(`Email Service: Processing ${type} email for ${email}`);
  
  let verificationLink = `${baseUrl}/auth/welcome?email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}`;

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
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const searchEmail = email.toLowerCase().trim();
    const user = allUsers.find(u => {
      const authEmail = u.email?.toLowerCase();
      const realEmail = u.user_metadata?.real_email?.toLowerCase();
      return authEmail === searchEmail || realEmail === searchEmail;
    });
  
    if (user && !user.email_confirmed_at) {
      console.log(`User ${email} is not confirmed, upgrading welcome email to signup link`);
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: user.email!,
        options: { redirectTo },
      });
      if (!linkError) verificationLink = linkData.properties.action_link;
    }
  }

  const isWelcome = type === 'welcome';
  return resend.emails.send({
    from: 'TapIn <noreply@securim.ca>',
    to: [email],
    subject: isWelcome ? `Welcome to TapIn, ${fullName}!` : 'Verify your email for TapIn!',
    html: getEmailHtml(fullName, verificationLink, isWelcome),
  });
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
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const radius = parseInt(c.req.query('radius') || '5000');
  const userId = c.req.query('userId');
  const { data, error } = await supabase.rpc('find_nearby_users', { lat, lng, max_dist_meters: radius, exclude_id: userId || null });
  if (error) return c.json({ error: error.message }, 500);
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
    await supabase.from('profiles').update({ latitude, longitude, location_name: address, last_seen: new Date().toISOString() }).eq('id', userId);
    const { data: existingRooms } = await supabase.rpc('find_nearby_rooms', { lat: latitude, lng: longitude, max_dist_meters: 1000 });
    const publicRooms = (existingRooms || []).filter((r: any) => r.type === 'public');
    if (publicRooms.length > 0) {
      const nearestRoom = publicRooms.sort((a: any, b: any) => calculateDistance(latitude, longitude, a.latitude, a.longitude) - calculateDistance(latitude, longitude, b.latitude, b.longitude))[0];
      await supabase.from('room_participants').upsert({ room_id: nearestRoom.id, user_id: userId, left_at: null }, { onConflict: 'room_id,user_id' });
      return c.json({ joinedRoomIds: [nearestRoom.id], activeRoomIds: publicRooms.map((r: any) => r.id), serverTime: new Date().toISOString() });
    }
    const { data: newRoom } = await supabase.from('chat_rooms').insert({ name: address || 'Nearby Zone', type: 'public', latitude, longitude, radius: 500 }).select().single();
    if (newRoom) await supabase.from('room_participants').insert({ room_id: newRoom.id, user_id: userId });
    return c.json({ joinedRoomIds: newRoom ? [newRoom.id] : [], activeRoomIds: newRoom ? [newRoom.id] : [], serverTime: new Date().toISOString() });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.get('/rooms/user-rooms', async (c) => {
  const userId = c.req.query('userId');
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const { data: rooms, error } = await supabase.rpc('get_user_rooms_v3', { p_user_id: userId, p_lat: lat, p_lng: lng });
  if (error) return c.json({ error: error.message }, 500);
  return c.json((rooms || []).map((room: any) => ({
    id: room.id,
    name: room.type === 'private' ? (room.other_user_full_name || `@${room.other_user_username}` || 'Private Chat') : room.name,
    type: room.type, distance: room.distance !== null ? Math.round(room.distance) : null,
    last_message_at: room.last_message_created_at || null,
    last_message_preview: room.last_message_content ? room.last_message_content.substring(0, 50) : null
  })));
});

app.post('/messages', zValidator('json', z.object({ room_id: z.string(), sender_id: z.string(), content: z.string(), type: z.string().default('text') })), async (c) => {
  const body = c.req.valid('json');
  if (!checkRateLimit(body.sender_id)) return c.json({ error: 'Rate limit exceeded' }, 429);
  const { data, error } = await supabase.from('messages').insert({ room_id: body.room_id, sender_id: body.sender_id, content: body.content, type: body.type }).select().single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

app.get('/auth/callback', async (c) => {
  return c.html(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verifying - TapIn</title></head><body><script>const p = new URLSearchParams(window.location.search); const h = new URLSearchParams(window.location.hash.substring(1)); const s = new URLSearchParams(); [p, h].forEach(x => x.forEach((v, k) => s.append(k, v))); window.location.href = "tapin://auth/callback?" + s.toString();</script></body></html>`);
});

app.get('/auth/welcome', async (c) => {
  const email = c.req.query('email');
  const name = c.req.query('name') || 'Friend';
  return c.html(`<!DOCTYPE html><html><body><h1>Welcome, ${name}!</h1><p>Email ${email} verified.</p><a href="tapin://auth/login">Back to App</a></body></html>`);
});

app.post('/auth/signup', zValidator('json', z.object({ email: z.string().email(), password: z.string().min(6), full_name: z.string(), username: z.string() })), async (c) => {
  const { email: realEmail, password, full_name, username } = c.req.valid('json');
  const authEmail = `${username.toLowerCase()}@tapin.internal`;
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({ email: authEmail, password, email_confirm: true, user_metadata: { full_name, username, real_email: realEmail } });
  if (userError) return c.json({ error: userError.message }, 400);
  await supabase.from('profiles').upsert({ id: userData.user.id, full_name, username, email: realEmail }, { onConflict: 'id' });
  await sendVerificationEmail(realEmail, full_name, 'welcome');
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

export default {
  port: Number(process.env.PORT) || 3003,
  fetch: app.fetch,
};