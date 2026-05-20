export interface Env {
  DB: D1Database;
  AUTH_SECRET: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  created_at: number;
}

export interface IncenseLog {
  id: string;
  user_id: string;
  type: 'career' | 'love' | 'health' | 'study';
  wish: string;
  created_at: number;
  burned_at: number;  // When the incense finishes burning (0 = still burning)
}

export const INCENSE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface WoodFishLog {
  id: string;
  user_id: string;
  count: number;
  merit: number;
  created_at: number;
}

export interface JwtPayload {
  [key: string]: any;
  sub: string;
  email: string;
  username: string;
  exp: number;
}