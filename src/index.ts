import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
// @ts-ignore
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env } from './types';
import { register, login, getCurrentUser, getAuthToken } from './auth';
import { burnIncense, getMyIncense, getLeaderboardData, getRecentData } from './incense';
import { tapWoodFish, getMyWoodFish, getWoodFishLeaderboardData, getWoodFishStats } from './woodfish';
import { initDB } from './db';

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors({
  origin: '*',
  credentials: true,
}));

// Serve static files
app.use('/favicon.ico', serveStatic({ manifest }));
app.use('/logo.svg', serveStatic({ manifest }));
app.use('/style.css', serveStatic({ manifest }));

// Initialize DB on first request
let dbInitialized = false;
async function ensureDBinitialized(env: Env) {
  if (!dbInitialized) {
    await initDB(env.DB);
    dbInitialized = true;
  }
}

// HTML pages
app.get('/', serveStatic({ path: 'index.html', manifest }));
app.get('/burn', serveStatic({ path: 'burn.html', manifest }));
app.get('/woodfish', serveStatic({ path: 'woodfish.html', manifest }));
app.get('/me', serveStatic({ path: 'me.html', manifest }));
app.get('/auth', serveStatic({ path: 'auth.html', manifest }));

// API Routes
app.post('/api/auth/register', async (c) => {
  await ensureDBinitialized(c.env);

  const { username, email, password } = await c.req.json();

  const result = await register(c.env, username, email, password);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(
    { success: true, message: 'Registration successful' },
    {
      headers: {
        'Set-Cookie': `auth_token=${result.token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`,
      },
    }
  );
});

app.post('/api/auth/login', async (c) => {
  await ensureDBinitialized(c.env);

  const { email, password } = await c.req.json();

  const result = await login(c.env, email, password);

  if (!result.success) {
    return c.json({ error: result.error }, 401);
  }

  return c.json(
    { success: true, message: 'Login successful' },
    {
      headers: {
        'Set-Cookie': `auth_token=${result.token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`,
      },
    }
  );
});

app.post('/api/auth/logout', (c) => {
  return c.json(
    { success: true, message: 'Logged out' },
    {
      headers: {
        'Set-Cookie': 'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
      },
    }
  );
});

app.get('/api/auth/me', async (c) => {
  await ensureDBinitialized(c.env);

  const user = await getCurrentUser(c.req.raw, c.env);

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  return c.json({ user });
});

app.post('/api/incense', async (c) => {
  await ensureDBinitialized(c.env);

  const user = await getCurrentUser(c.req.raw, c.env);
  if (!user) {
    return c.json({ error: 'Please login first' }, 401);
  }

  const { type, wish } = await c.req.json();

  const result = await burnIncense(c.env, user.id, type, wish);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true, data: result.data });
});

app.get('/api/incense/my', async (c) => {
  await ensureDBinitialized(c.env);

  const user = await getCurrentUser(c.req.raw, c.env);
  if (!user) {
    return c.json({ error: 'Please login first' }, 401);
  }

  const data = await getMyIncense(c.env, user.id);
  return c.json(data);
});

app.get('/api/incense/leaderboard', async (c) => {
  await ensureDBinitialized(c.env);

  const data = await getLeaderboardData(c.env);
  return c.json({ leaderboard: data });
});

app.get('/api/incense/recent', async (c) => {
  await ensureDBinitialized(c.env);

  const data = await getRecentData(c.env);
  return c.json({ recent: data });
});

// Wood Fish API Routes
app.post('/api/woodfish', async (c) => {
  await ensureDBinitialized(c.env);

  const user = await getCurrentUser(c.req.raw, c.env);
  if (!user) {
    return c.json({ error: 'Please login first' }, 401);
  }

  const { count } = await c.req.json();

  const result = await tapWoodFish(c.env, user.id, count || 1);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ success: true, data: result.data });
});

app.get('/api/woodfish/my', async (c) => {
  await ensureDBinitialized(c.env);

  const user = await getCurrentUser(c.req.raw, c.env);
  if (!user) {
    return c.json({ error: 'Please login first' }, 401);
  }

  const data = await getMyWoodFish(c.env, user.id);
  return c.json(data);
});

app.get('/api/woodfish/leaderboard', async (c) => {
  await ensureDBinitialized(c.env);

  const data = await getWoodFishLeaderboardData(c.env);
  return c.json({ leaderboard: data });
});

app.get('/api/woodfish/stats', async (c) => {
  await ensureDBinitialized(c.env);

  const data = await getWoodFishStats(c.env);
  return c.json(data);
});

export default app;