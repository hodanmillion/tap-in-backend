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
  
const CHAT_RADIUS_METERS = 20;
const CHAT_EXPIRY_HOURS = 48;

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * cVal;
}

app.post('/rooms/sync', async (c) => {
  const { userId, latitude, longitude, address } = await c.req.json();

  await supabase
    .from('profiles')
    .update({ 
      latitude, 
      longitude, 
      last_seen: new Date().toISOString() 
    })
    .eq('id', userId);

  const now = new Date();
  const { data: publicRooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('*')
    .in('type', ['public', 'auto_generated'])
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);

  if (roomsError) return c.json({ error: roomsError.message }, 400);

  const nearbyRooms = (publicRooms || []).filter(room => {
    if (room.latitude === null || room.longitude === null) return false;
    const distance = calculateDistance(latitude, longitude, room.latitude, room.longitude);
    return distance <= CHAT_RADIUS_METERS;
  });

  let nearbyRoomIds = nearbyRooms.map(r => r.id);

  if (nearbyRoomIds.length === 0) {
    const latDelta = CHAT_RADIUS_METERS / 111000;
    const { data: anyNearbyRooms } = await supabase
      .from('chat_rooms')
      .select('id, latitude, longitude')
      .in('type', ['public', 'auto_generated'])
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .gte('latitude', latitude - latDelta)
      .lte('latitude', latitude + latDelta)
      .gte('longitude', longitude - latDelta)
      .lte('longitude', longitude + latDelta);

    const actuallyNearby = (anyNearbyRooms || []).filter(room => {
      const distance = calculateDistance(latitude, longitude, room.latitude, room.longitude);
      return distance <= CHAT_RADIUS_METERS;
    });

    if (actuallyNearby.length === 0) {
      const expiresAt = new Date(now.getTime() + CHAT_EXPIRY_HOURS * 60 * 60 * 1000);
      const roomName = (address && address.split(',')[0]) || `Chat @ ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      
      const { data: newRoom } = await supabase
        .from('chat_rooms')
        .insert({
          name: roomName,
          type: 'auto_generated',
          latitude,
          longitude,
          radius: CHAT_RADIUS_METERS,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (newRoom) {
        nearbyRoomIds.push(newRoom.id);
        await supabase.from('room_participants').insert({ room_id: newRoom.id, user_id: userId });
      }
    }
  }

  const { data: currentParticipations } = await supabase
    .from('room_participants')
    .select('room_id, chat_rooms!inner(type)')
    .eq('user_id', userId)
    .in('chat_rooms.type', ['public', 'auto_generated']);

  const currentRoomIds = currentParticipations?.map(p => p.room_id) || [];

  const roomsToJoin = nearbyRoomIds.filter(id => !currentRoomIds.includes(id));
  if (roomsToJoin.length > 0) {
    await supabase
      .from('room_participants')
      .insert(roomsToJoin.map(roomId => ({ room_id: roomId, user_id: userId })));
  }

  const roomsToLeave = currentRoomIds.filter(id => !nearbyRoomIds.includes(id));
  if (roomsToLeave.length > 0) {
    await supabase
      .from('room_participants')
      .delete()
      .eq('user_id', userId)
      .in('room_id', roomsToLeave);
  }

  return c.json({
    active_rooms: nearbyRoomIds,
    joined: roomsToJoin,
    left: roomsToLeave
  });
});
  
app.get('/rooms/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');

  const now = new Date();
  const latDelta = CHAT_RADIUS_METERS / 111000;
  const lngDelta = CHAT_RADIUS_METERS / (111000 * Math.cos(lat * (Math.PI / 180)));

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    .gte('latitude', lat - latDelta)
    .lte('latitude', lat + latDelta)
    .gte('longitude', lng - lngDelta)
    .lte('longitude', lng + lngDelta);

  if (error) return c.json({ error: error.message }, 400);

  const filteredRooms = data.filter((room) => {
    const distance = calculateDistance(lat, lng, room.latitude, room.longitude);
    return distance <= CHAT_RADIUS_METERS;
  });

  return c.json(filteredRooms);
});
  
  // Get nearby users
  app.get('/profiles/nearby', async (c) => {
    const lat = parseFloat(c.req.query('lat') || '0');
    const lng = parseFloat(c.req.query('lng') || '0');
    const radius = parseFloat(c.req.query('radius') || '5000'); // 5km for users discovery
    const currentUserId = c.req.query('userId');
  
    const latDelta = radius / 111000;
    const lngDelta = radius / (111000 * Math.cos(lat * (Math.PI / 180)));
  
    let query = supabase
      .from('profiles')
      .select('*')
      .gte('latitude', lat - latDelta)
      .lte('latitude', lat + latDelta)
      .gte('longitude', lng - lngDelta)
      .lte('longitude', lng + lngDelta);
  
    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }
  
    const { data, error } = await query;
  
    if (error) return c.json({ error: error.message }, 400);
  
    // Filter by actual distance
    const filteredProfiles = data.filter((profile) => {
      if (!profile.latitude || !profile.longitude) return false;
      const dLat = (profile.latitude - lat) * (Math.PI / 180);
      const dLng = (profile.longitude - lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * (Math.PI / 180)) *
          Math.cos(profile.latitude * (Math.PI / 180)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const cVal = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371000 * cVal;
      return distance <= radius;
    });
  
    return c.json(filteredProfiles);
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
  
  app.get('/friends/requests/:userId', async (c) => {
    const userId = c.req.param('userId');
    const { data, error } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
      .eq('receiver_id', userId)
      .eq('status', 'pending');
  
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
  
  app.get('/friends/:userId', async (c) => {
    const userId = c.req.param('userId');
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        user_1:profiles!friends_user_id_1_fkey(*),
        user_2:profiles!friends_user_id_2_fkey(*)
      `)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);
  
    if (error) return c.json({ error: error.message }, 400);
  
    // Map to just the friend's profile
    const friends = data.map((f: { user_1: { id: string }; user_2: { id: string } }) => {
      return f.user_1.id === userId ? f.user_2 : f.user_1;
    });
  
    return c.json(friends);
  });
  
  app.post('/rooms/private', async (c) => {
    const { user1_id, user2_id } = await c.req.json();
  
    // Check if private room already exists between these two users
    const { data: rooms, error: fetchError } = await supabase
      .from('chat_rooms')
      .select('id, room_participants!inner(user_id)')
      .eq('type', 'private')
      .eq('room_participants.user_id', user1_id);
  
    if (fetchError) return c.json({ error: fetchError.message }, 400);
  
    // Further filter for rooms where user2_id is also a participant
    // (This is a bit tricky with Supabase's simple JS client, but doable)
    for (const room of rooms || []) {
      const { data: participants } = await supabase
        .from('room_participants')
        .select('user_id')
        .eq('room_id', room.id);
      
      const userIds = participants?.map(p => p.user_id);
      if (userIds?.includes(user2_id)) {
        return c.json({ room_id: room.id });
      }
    }
  
    // Create new private room
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert({ name: 'Private Chat', type: 'private' })
      .select()
      .single();
  
    if (createError) return c.json({ error: createError.message }, 400);
  
    // Add participants
    await supabase
      .from('room_participants')
      .insert([
        { room_id: newRoom.id, user_id: user1_id },
        { room_id: newRoom.id, user_id: user2_id }
      ]);
  
    return c.json({ room_id: newRoom.id });
  });
  
  export default {
  fetch: app.fetch,
  port: 3002,
};
