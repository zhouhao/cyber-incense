import type { Env } from './types';
import { createIncenseLog, getUserIncenseLogs, getLeaderboard, getUserIncenseCount, getRecentIncenseLogs } from './db';

const VALID_TYPES = ['career', 'love', 'health', 'study'];

export async function burnIncense(
  env: Env,
  userId: string,
  type: string,
  wish: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Validate type
  if (!VALID_TYPES.includes(type)) {
    return { success: false, error: 'Invalid incense type' };
  }

  // Validate wish
  if (!wish || wish.trim().length === 0) {
    return { success: false, error: 'Wish cannot be empty' };
  }

  if (wish.length > 100) {
    return { success: false, error: 'Wish must be 100 characters or less' };
  }

  // Create incense log
  const id = crypto.randomUUID();
  const log = await createIncenseLog(env.DB, id, userId, type as 'career' | 'love' | 'health' | 'study', wish.trim());

  if (!log) {
    return { success: false, error: 'Failed to record incense' };
  }

  // Get updated count
  const count = await getUserIncenseCount(env.DB, userId);

  // Determine achievements
  const achievements: string[] = [];
  if (count === 1) achievements.push('first_incense');
  if (count >= 10) achievements.push('incense_10');
  if (count >= 50) achievements.push('incense_50');

  return {
    success: true,
    data: {
      id: log.id,
      type: log.type,
      wish: log.wish,
      created_at: log.created_at,
      count,
      achievements,
    },
  };
}

export async function getMyIncense(env: Env, userId: string) {
  const logs = await getUserIncenseLogs(env.DB, userId);
  const count = await getUserIncenseCount(env.DB, userId);

  return {
    logs,
    count,
    achievements: {
      first_incense: count >= 1,
      incense_10: count >= 10,
      incense_50: count >= 50,
    },
  };
}

export async function getLeaderboardData(env: Env) {
  return await getLeaderboard(env.DB);
}

export async function getRecentData(env: Env) {
  return await getRecentIncenseLogs(env.DB, 10);
}