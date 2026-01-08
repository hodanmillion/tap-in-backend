import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { serve } from '@hono/node-server';

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

  app.post('/rooms/sync', async (c) => {
    const { userId, latitude, longitude, address } = await c.req.json();

    if (!userId) return c.json({ error: 'User ID is required' }, 400);

    // Ensure profile exists and update location (trigger handles geography column)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId,
        latitude, 
        longitude, 
        last_seen: new Date().toISOString() 
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return c.json({ error: profileError.message }, 400);
    }


  // Get nearby rooms using PostGIS (highly optimized)
  const { data: nearbyRooms, error: roomsError } = await supabase.rpc('get_nearby_rooms', {
    user_lat: latitude,
    user_lng: longitude,
    radius_meters: CHAT_RADIUS_METERS
  });

  if (roomsError) return c.json({ error: roomsError.message }, 400);

  let nearbyRoomIds = (nearbyRooms || []).map((r: any) => r.id);

  // If no rooms nearby, create one automatically
  if (nearbyRoomIds.length === 0) {
    const CREATION_CHECK_RADIUS = CHAT_RADIUS_METERS + 10;
    const { data: checkNearby } = await supabase.rpc('get_nearby_rooms', {
      user_lat: latitude,
      user_lng: longitude,
      radius_meters: CREATION_CHECK_RADIUS
    });

    if (!checkNearby || checkNearby.length === 0) {
      const expiresAt = new Date(Date.now() + CHAT_EXPIRY_HOURS * 60 * 60 * 1000);
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
    } else {
      nearbyRoomIds = checkNearby.map((r: any) => r.id);
    }
  }

  // Handle joining/leaving rooms
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

    // Notifications
    for (const roomId of roomsToJoin) {
      const room = nearbyRooms?.find((r: any) => r.id === roomId) || 
                   (await supabase.from('chat_rooms').select('name, type').eq('id', roomId).single()).data;
      
      if (room && room.type === 'auto_generated') {
        await createNotification(
          userId,
          'new_room',
          'New Chat Nearby',
          `You've joined "${room.name}" automatically because you're nearby.`,
          { room_id: roomId }
        );
      }
    }
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

  const { data, error } = await supabase.rpc('get_nearby_rooms', {
    user_lat: lat,
    user_lng: lng,
    radius_meters: CHAT_RADIUS_METERS
  });

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});
  
app.get('/profiles/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') || '0');
  const lng = parseFloat(c.req.query('lng') || '0');
  const radius = parseFloat(c.req.query('radius') || '5000');
  const currentUserId = c.req.query('userId');

  const { data, error } = await supabase.rpc('get_nearby_profiles', {
    user_lat: lat,
    user_lng: lng,
    radius_meters: radius,
    current_user_id: currentUserId
  });

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});
  
// Helper to create notifications
async function createNotification(userId: string, type: string, title: string, content: string, data: any = {}) {
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      content,
      data
    });
}

// Manage friend requests
app.post('/friends/request', async (c) => {
  const { sender_id, receiver_id } = await c.req.json();
  
  const { data: sender } = await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', sender_id)
    .single();

  const { data, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id, receiver_id, status: 'pending' })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  await createNotification(
    receiver_id,
    'friend_request',
    'New Friend Request',
    `${sender?.full_name || sender?.username || 'Someone'} sent you a friend request.`,
    { sender_id }
  );

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
    .select('*, receiver:profiles!friend_requests_receiver_id_fkey(username, full_name)')
    .eq('id', request_id)
    .single();

  if (fetchError || !request) return c.json({ error: 'Request not found' }, 404);

  await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', request_id);

  const { data, error } = await supabase
    .from('friends')
    .insert({ user_id_1: request.sender_id, user_id_2: request.receiver_id })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);

  await createNotification(
    request.sender_id,
    'friend_accept',
    'Friend Request Accepted',
    `${request.receiver?.full_name || request.receiver?.username || 'Someone'} accepted your friend request!`,
    { friend_id: request.receiver_id }
  );

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

  const friends = data.map((f: any) => {
    return f.user_1.id === userId ? f.user_2 : f.user_1;
  });

  return c.json(friends);
});

app.post('/rooms/private', async (c) => {
  const { user1_id, user2_id } = await c.req.json();

  const { data: user1 } = await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', user1_id)
    .single();

  const { data: rooms, error: fetchError } = await supabase
    .from('chat_rooms')
    .select('id, room_participants!inner(user_id)')
    .eq('type', 'private')
    .eq('room_participants.user_id', user1_id);

  if (fetchError) return c.json({ error: fetchError.message }, 400);

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

  const { data: newRoom, error: createError } = await supabase
    .from('chat_rooms')
    .insert({ name: 'Private Chat', type: 'private' })
    .select()
    .single();

  if (createError) return c.json({ error: createError.message }, 400);

  await supabase
    .from('room_participants')
    .insert([
      { room_id: newRoom.id, user_id: user1_id },
      { room_id: newRoom.id, user_id: user2_id }
    ]);

  await createNotification(
    user2_id,
    'new_message',
    'New Private Chat',
    `${user1?.full_name || user1?.username || 'Someone'} started a private chat with you.`,
    { room_id: newRoom.id, sender_id: user1_id }
  );

  return c.json({ room_id: newRoom.id });
});

// Notifications endpoints
app.get('/notifications/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 400);
  return c.json(data);
});

app.post('/notifications/read', async (c) => {
  const { notificationIds } = await c.req.json();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ success: true });
});
  
const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
