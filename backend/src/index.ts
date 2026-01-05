import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.use(
  '*',
  cors({
    credentials: true,
    origin: (origin) => origin || '*',
  })
);

app.get('/', (c) => {
  return c.text('Tap In API is running');
});

// Update user profile and location
const profileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().optional(),
  full_name: z.string().optional(),
  avatar_url: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

app.post('/profiles', zValidator('json', profileSchema), async (c) => {
  const profile = c.req.valid('json');
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      ...profile,
      last_seen: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

// Get nearby chat rooms
app.get('/rooms/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const radius = parseFloat(c.req.query('radius') || '1000'); // meters

  // Simple bounding box for nearby rooms (for more accuracy, use PostGIS if enabled)
  // 1 degree lat ~ 111km, 1 degree lng ~ 111km * cos(lat)
  const latDelta = radius / 111000;
  const lngDelta = radius / (111000 * Math.cos(lat * (Math.PI / 180)));

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .gte('latitude', lat - latDelta)
    .lte('latitude', lat + latDelta)
    .gte('longitude', lng - lngDelta)
    .lte('longitude', lng + lngDelta);

  if (error) return c.json({ error: error.message }, 400);

  // Filter by actual distance
  const filteredRooms = data.filter((room) => {
    const dLat = (room.latitude - lat) * (Math.PI / 180);
    const dLng = (room.longitude - lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) *
        Math.cos(room.latitude * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = 6371000 * cVal; // Distance in meters
    return distance <= (room.radius || radius);
  });

  return c.json(filteredRooms);
});

// Manage friend requests
app.post('/friends/request', async (c) => {
  const { sender_id, receiver_id } = await c.req.json();
  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id, receiver_id, status: 'pending' })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

app.post('/friends/accept', async (c) => {
  const { request_id } = await c.req.json();
  
  const { data: request, error: fetchError } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (fetchError || !request) return c.json({ error: 'Request not found' }, 404);

  // Update request status
  await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', request_id);

  // Add to friends table
  const { data, error } = await supabase
    .from('friends')
    .insert({ user_id_1: request.sender_id, user_id_2: request.receiver_id })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

export default {
  fetch: app.fetch,
  port: 3002,
};
