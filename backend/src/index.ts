import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing!');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
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

// ... (rest of the code)

// Start server for Node.js
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT) || 3002;
  console.log(`Server is running on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;
