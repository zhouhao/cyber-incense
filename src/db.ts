import { D1Database } from '@cloudflare/workers-types';
import type { User, IncenseLog, WoodFishLog } from './types';

export async function initDB(db: D1Database): Promise<void> {
  // Handle migrations for existing tables
  try {
    // Migration: add total_merit column to users if it doesn't exist
    const usersColumns = (await db.prepare("PRAGMA table_info(users)").all()).results.map((r: any) => r.name);
    if (!usersColumns.includes('total_merit')) {
      await db.exec('ALTER TABLE users ADD COLUMN total_merit INTEGER NOT NULL DEFAULT 0');
    }

    // Migration: add burned_at and duration_minutes to incense_logs if they don't exist
    const incenseColumns = (await db.prepare("PRAGMA table_info(incense_logs)").all()).results.map((r: any) => r.name);
    if (!incenseColumns.includes('burned_at')) {
      await db.exec('ALTER TABLE incense_logs ADD COLUMN burned_at INTEGER NOT NULL DEFAULT 0');
    }
    if (!incenseColumns.includes('duration_minutes')) {
      await db.exec('ALTER TABLE incense_logs ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 15');
    }
  } catch (e) {
    // Tables don't exist yet, will be created below
  }

  // Create tables
  await db.exec('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at INTEGER NOT NULL, total_merit INTEGER NOT NULL DEFAULT 0)');
  await db.exec('CREATE TABLE IF NOT EXISTS incense_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL CHECK(type IN (\'career\', \'love\', \'health\', \'study\')), wish TEXT NOT NULL, created_at INTEGER NOT NULL, burned_at INTEGER NOT NULL DEFAULT 0, duration_minutes INTEGER NOT NULL DEFAULT 15)');
  await db.exec('CREATE TABLE IF NOT EXISTS wood_fish_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), count INTEGER NOT NULL DEFAULT 1, merit INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)');

  // Create indexes (ignore errors if already exist)
  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_incense_user_id ON incense_logs(user_id)');
  } catch (e) {}
  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_incense_created_at ON incense_logs(created_at)');
  } catch (e) {}
  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_incense_burned_at ON incense_logs(burned_at)');
  } catch (e) {}
  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_woodfish_user_id ON wood_fish_logs(user_id)');
  } catch (e) {}
}

export async function createUser(
  db: D1Database,
  id: string,
  username: string,
  email: string,
  passwordHash: string
): Promise<User | null> {
  const result = await db
    .prepare(
      'INSERT INTO users (id, username, email, password, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, username, email, passwordHash, Date.now())
    .run();

  if (result.success) {
    return { id, username, email, password: passwordHash, total_merit: 0, created_at: Date.now() };
  }
  return null;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();

  return result || null;
}

export async function getUserByUsername(
  db: D1Database,
  username: string
): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first<User>();

  return result || null;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();

  return result || null;
}

export async function addUserMerit(db: D1Database, userId: string, merit: number): Promise<number> {
  await db
    .prepare('UPDATE users SET total_merit = total_merit + ? WHERE id = ?')
    .bind(merit, userId)
    .run();

  const result = await db
    .prepare('SELECT total_merit FROM users WHERE id = ?')
    .bind(userId)
    .first<{ total_merit: number }>();

  return result?.total_merit || 0;
}

// Calculate total merit from incense and woodfish logs
export async function getTotalMeritFromLogs(db: D1Database, userId: string): Promise<number> {
  // Sum incense merit (duration_minutes * 2)
  const incenseResult = await db
    .prepare('SELECT COALESCE(SUM(duration_minutes * 2), 0) as merit FROM incense_logs WHERE user_id = ?')
    .bind(userId)
    .first<{ merit: number }>();

  // Sum woodfish merit
  const woodfishResult = await db
    .prepare('SELECT COALESCE(SUM(merit), 0) as merit FROM wood_fish_logs WHERE user_id = ?')
    .bind(userId)
    .first<{ merit: number }>();

  return (incenseResult?.merit || 0) + (woodfishResult?.merit || 0);
}

export async function createIncenseLog(
  db: D1Database,
  id: string,
  userId: string,
  type: 'career' | 'love' | 'health' | 'study',
  wish: string,
  durationMinutes: number = 15
): Promise<IncenseLog | null> {
  const createdAt = Date.now();
  const burnedAt = createdAt + durationMinutes * 60 * 1000;
  const result = await db
    .prepare(
      'INSERT INTO incense_logs (id, user_id, type, wish, created_at, burned_at, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(id, userId, type, wish, createdAt, burnedAt, durationMinutes)
    .run();

  if (result.success) {
    return { id, user_id: userId, type, wish, created_at: createdAt, burned_at: burnedAt, duration_minutes: durationMinutes };
  }
  return null;
}

export async function getUserIncenseLogs(
  db: D1Database,
  userId: string,
  limit = 20
): Promise<IncenseLog[]> {
  const result = await db
    .prepare(
      'SELECT * FROM incense_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .bind(userId, limit)
    .all<IncenseLog>();

  return result.results;
}

export async function getUserActiveIncense(
  db: D1Database,
  userId: string
): Promise<IncenseLog | null> {
  const now = Date.now();
  const result = await db
    .prepare(
      'SELECT * FROM incense_logs WHERE user_id = ? AND burned_at > ? ORDER BY created_at DESC LIMIT 1'
    )
    .bind(userId, now)
    .first<IncenseLog>();

  return result || null;
}

export async function getLeaderboard(
  db: D1Database,
  limit = 10
): Promise<{ username: string; count: number }[]> {
  // Get week start timestamp
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();

  const result = await db
    .prepare(
      `SELECT u.username, COUNT(i.id) as count
       FROM incense_logs i
       JOIN users u ON i.user_id = u.id
       WHERE i.created_at >= ?
       GROUP BY u.id, u.username
       ORDER BY count DESC
       LIMIT ?`
    )
    .bind(weekStartTs, limit)
    .all<{ username: string; count: number }>();

  return result.results;
}

export async function getUserIncenseCount(
  db: D1Database,
  userId: string
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM incense_logs WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  return result?.count || 0;
}

export async function getRecentIncenseLogs(
  db: D1Database,
  limit = 10
): Promise<(IncenseLog & { username: string })[]> {
  const result = await db
    .prepare(
      `SELECT i.*, u.username
       FROM incense_logs i
       JOIN users u ON i.user_id = u.id
       ORDER BY i.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<IncenseLog & { username: string }>();

  return result.results;
}

// Wood Fish (敲木鱼) functions
export async function createWoodFishLog(
  db: D1Database,
  id: string,
  userId: string,
  count: number,
  merit: number
): Promise<WoodFishLog | null> {
  const createdAt = Date.now();
  const result = await db
    .prepare(
      'INSERT INTO wood_fish_logs (id, user_id, count, merit, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, userId, count, merit, createdAt)
    .run();

  if (result.success) {
    return { id, user_id: userId, count, merit, created_at: createdAt };
  }
  return null;
}

export async function getUserWoodFishLogs(
  db: D1Database,
  userId: string,
  limit = 50
): Promise<WoodFishLog[]> {
  const result = await db
    .prepare(
      'SELECT * FROM wood_fish_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .bind(userId, limit)
    .all<WoodFishLog>();

  return result.results;
}

export async function getUserTotalWoodFish(
  db: D1Database,
  userId: string
): Promise<{ count: number; merit: number }> {
  const result = await db
    .prepare('SELECT SUM(count) as total_count, SUM(merit) as total_merit FROM wood_fish_logs WHERE user_id = ?')
    .bind(userId)
    .first<{ total_count: number; total_merit: number }>();

  return {
    count: result?.total_count || 0,
    merit: result?.total_merit || 0
  };
}

export async function getWoodFishLeaderboard(
  db: D1Database,
  limit = 10
): Promise<{ username: string; count: number; merit: number }[]> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartTs = weekStart.getTime();

  const result = await db
    .prepare(
      `SELECT u.username, SUM(w.count) as count, SUM(w.merit) as merit
       FROM wood_fish_logs w
       JOIN users u ON w.user_id = u.id
       WHERE w.created_at >= ?
       GROUP BY u.id, u.username
       ORDER BY merit DESC
       LIMIT ?`
    )
    .bind(weekStartTs, limit)
    .all<{ username: string; count: number; merit: number }>();

  return result.results;
}