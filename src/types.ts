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
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  exp: number;
}