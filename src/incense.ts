import type { Env, IncenseDuration } from './types';
import { createIncenseLog, getUserIncenseLogs, getLeaderboard, getUserIncenseCount, getRecentIncenseLogs, getUserActiveIncense } from './db';

const VALID_TYPES = ['career', 'love', 'health', 'study'];
const VALID_DURATIONS = [15, 30, 60];

export async function burnIncense(
  env: Env,
  userId: string,
  type: string,
  wish: string,
  durationMinutes: number = 15
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Validate type
  if (!VALID_TYPES.includes(type)) {
    return { success: false, error: 'Invalid incense type' };
  }

  // Validate duration
  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return { success: false, error: 'Invalid duration' };
  }

  // Validate wish
  if (!wish || wish.trim().length === 0) {
    return { success: false, error: 'Wish cannot be empty' };
  }

  if (wish.length > 100) {
    return { success: false, error: 'Wish must be 100 characters or less' };
  }

  // Calculate merit (2x duration in minutes)
  const merit = durationMinutes * 2;

  // Create incense log
  const id = crypto.randomUUID();
  const log = await createIncenseLog(env.DB, id, userId, type as 'career' | 'love' | 'health' | 'study', wish.trim(), durationMinutes);

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
      burned_at: log.burned_at,
      duration_minutes: log.duration_minutes,
      merit,  // 功德 = 时长 * 2
      remaining_ms: log.burned_at - Date.now(),
      count,
      achievements,
    },
  };
}

export async function getMyIncense(env: Env, userId: string) {
  const logs = await getUserIncenseLogs(env.DB, userId);
  const count = await getUserIncenseCount(env.DB, userId);
  const activeIncense = await getUserActiveIncense(env.DB, userId);

  return {
    logs,
    count,
    total_merit: logs.reduce((sum, log) => sum + (log.duration_minutes * 2), 0),
    active_incense: activeIncense ? {
      id: activeIncense.id,
      type: activeIncense.type,
      wish: activeIncense.wish,
      created_at: activeIncense.created_at,
      burned_at: activeIncense.burned_at,
      duration_minutes: activeIncense.duration_minutes,
      remaining_ms: activeIncense.burned_at - Date.now(),
    } : null,
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