import type { Env } from './types';
import { createWoodFishLog, getUserWoodFishLogs, getUserTotalWoodFish, getWoodFishLeaderboard } from './db';

export async function tapWoodFish(
  env: Env,
  userId: string,
  count: number = 1
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Validate count
  if (count < 1 || count > 108) {
    return { success: false, error: 'Count must be between 1 and 108' };
  }

  // Calculate merit (base merit * multiplier)
  const baseMerit = count;
  // Bonus for completing a "round" (multiple of 108)
  const roundBonus = Math.floor(count / 108) * 10;
  const merit = baseMerit + roundBonus;

  // Create wood fish log
  const id = crypto.randomUUID();
  const log = await createWoodFishLog(env.DB, id, userId, count, merit);

  if (!log) {
    return { success: false, error: 'Failed to record wood fish tap' };
  }

  // Get updated totals
  const totals = await getUserTotalWoodFish(env.DB, userId);

  // Determine achievements
  const achievements: string[] = [];
  if (totals.count === 1) achievements.push('first_tap');
  if (totals.count >= 108) achievements.push('tap_108');
  if (totals.count >= 1000) achievements.push('tap_1000');
  if (totals.count >= 10000) achievements.push('tap_10000');

  return {
    success: true,
    data: {
      id: log.id,
      count: log.count,
      merit: log.merit,
      total_count: totals.count,
      total_merit: totals.merit,
      achievements,
      round_complete: count >= 108 ? Math.floor(count / 108) : 0,
    },
  };
}

export async function getMyWoodFish(env: Env, userId: string) {
  const logs = await getUserWoodFishLogs(env.DB, userId);
  const totals = await getUserTotalWoodFish(env.DB, userId);

  return {
    logs,
    total_count: totals.count,
    total_merit: totals.merit,
    achievements: {
      first_tap: totals.count >= 1,
      tap_108: totals.count >= 108,
      tap_1000: totals.count >= 1000,
      tap_10000: totals.count >= 10000,
    },
  };
}

export async function getWoodFishLeaderboardData(env: Env) {
  return await getWoodFishLeaderboard(env.DB);
}

export async function getWoodFishStats(env: Env) {
  const totalResult = await env.DB
    .prepare('SELECT SUM(count) as total_count, SUM(merit) as total_merit, COUNT(*) as total_sessions FROM wood_fish_logs')
    .first<{ total_count: number; total_merit: number; total_sessions: number }>();

  return {
    total_count: totalResult?.total_count || 0,
    total_merit: totalResult?.total_merit || 0,
    total_sessions: totalResult?.total_sessions || 0,
  };
}