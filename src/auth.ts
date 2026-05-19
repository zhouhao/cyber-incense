import * as jose from 'jose';
import type { Env, JwtPayload } from './types';
import { getUserByEmail, getUserByUsername, createUser, getUserById } from './db';
import bcrypt from 'bcryptjs';

const JWT_ALGORITHM = 'HS256';
const TOKEN_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateToken(
  payload: JwtPayload,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
}

export function getAuthToken(request: Request, env: Env): string | null {
  const cookies = parseCookies(request.headers.get('Cookie'));
  return cookies['auth_token'] || null;
}

export async function getCurrentUser(
  request: Request,
  env: Env
): Promise<{ id: string; email: string; username: string } | null> {
  const token = getAuthToken(request, env);
  if (!token) return null;

  const payload = await verifyToken(token, env.AUTH_SECRET);
  if (!payload) return null;

  const user = await getUserById(env.DB, payload.sub);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
  };
}

export async function register(
  env: Env,
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  // Validate input
  if (!username || !email || !password) {
    return { success: false, error: 'All fields are required' };
  }

  if (username.length < 3 || username.length > 20) {
    return { success: false, error: 'Username must be 3-20 characters' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };

  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Check if user exists
  const existingEmail = await getUserByEmail(env.DB, email);
  if (existingEmail) {
    return { success: false, error: 'Email already registered' };
  }

  const existingUsername = await getUserByUsername(env.DB, username);
  if (existingUsername) {
    return { success: false, error: 'Username already taken' };
  }

  // Create user
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const user = await createUser(env.DB, id, username, email, passwordHash);

  if (!user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Generate token
  const token = await generateToken(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
    env.AUTH_SECRET
  );

  return { success: true, token };
}

export async function login(
  env: Env,
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  const user = await getUserByEmail(env.DB, email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword) {
    return { success: false, error: 'Invalid email or password' };
  }

  const token = await generateToken(
    {
      sub: user.id,
      email: user.email,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
    env.AUTH_SECRET
  );

  return { success: true, token };
}