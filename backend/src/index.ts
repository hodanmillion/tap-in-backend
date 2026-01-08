import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Backend starting...');

const app = new Hono();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing! Backend may not function correctly.');
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
  try {
    const port = Number(process.env.PORT) || 3002;
    console.log(`Attempting to start server on port ${port}...`);
    serve({
      fetch: app.fetch,
      port,
    }, (info) => {
      console.log(`Server is listening on http://localhost:${info.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

export default app;
