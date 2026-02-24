// VibeCaddie Index 计算服务（基于 World Handicap System）
import { getPlayerRoundsWithRatings } from '../db/rounds';
import { updateVibecaddieIndex } from '../db/players';

// WHS 缩放表：最近 N 场中取最佳 K 场，附带初期调整值
const SCALING: Array<{ minRounds: number; bestN: number; adjustment: number }> = [
  { minRounds: 20, bestN: 8, adjustment:  0.0 },
  { minRounds: 19, bestN: 7, adjustment:  0.0 },
  { minRounds: 17, bestN: 6, adjustment:  0.0 },
  { minRounds: 15, bestN: 5, adjustment:  0.0 },
  { minRounds: 12, bestN: 4, adjustment:  0.0 },
  { minRounds:  9, bestN: 3, adjustment:  0.0 },
  { minRounds:  6, bestN: 2, adjustment:  0.0 },
  { minRounds:  5, bestN: 1, adjustment:  0.0 },
  { minRounds:  4, bestN: 1, adjustment: -1.0 },
  { minRounds:  3, bestN: 1, adjustment: -2.0 },
];

/**
 * 计算单场差异值
 * differential = (score - course_rating) × 113 / slope_rating
 */
export function calculateDifferential(
  score: number,
  courseRating: number,
  slopeRating: number
): number {
  return (score - courseRating) * 113 / slopeRating;
}

/**
 * 计算并保存 VibeCaddie Index
 * - 取最近 20 场有评级的轮次
 * - 选取最佳 N 个差异值取平均
 * - 乘以 0.96，加初期调整值，四舍五入到 1 位小数
 * - 少于 3 场则不计算，返回 null
 */
export async function calculateAndSaveVibecaddieIndex(userId: string): Promise<number | null> {
  const rounds = await getPlayerRoundsWithRatings(userId);

  const differentials = rounds
    .filter(r => r.total_score !== null && r.course_rating !== null && r.slope_rating !== null)
    .map(r => calculateDifferential(r.total_score!, r.course_rating!, r.slope_rating!));

  if (differentials.length < 3) return null;

  const rule = SCALING.find(s => differentials.length >= s.minRounds)!;

  // 升序排列，取最佳 N 个（最小值）
  const sorted = [...differentials].sort((a, b) => a - b);
  const best = sorted.slice(0, rule.bestN);
  const avg = best.reduce((sum, d) => sum + d, 0) / best.length;

  const index = Math.round((avg * 0.96 + rule.adjustment) * 10) / 10;

  await updateVibecaddieIndex(userId, index);
  return index;
}
