// 学习更新服务 — 将轮次结果写入球员洞历史统计

import { getRoundById, getRoundHoles, updatePlayerHoleHistory } from '@/lib/db/rounds';
import { getPlayerHoleHistory } from '@/lib/db/players';

// ---------- Types ----------

export interface HistoryData {
  rounds_played: number;
  driver_used: number;
  control_used: number;
  penalties: number;
  avg_score: number;
}

export interface HoleData {
  tee_club: string;
  tee_result: string;
  score: number;
}

// ---------- 纯函数：计算新的历史统计 ----------

export function computeHistoryUpdate(
  existing: HistoryData | null,
  holeData: HoleData,
): HistoryData {
  const isDriver = holeData.tee_club === 'D';
  const isPenalty = holeData.tee_result === 'PEN';

  if (!existing) {
    return {
      rounds_played: 1,
      driver_used: isDriver ? 1 : 0,
      control_used: isDriver ? 0 : 1,
      penalties: isPenalty ? 1 : 0,
      avg_score: holeData.score,
    };
  }

  const newRoundsPlayed = existing.rounds_played + 1;
  return {
    rounds_played: newRoundsPlayed,
    driver_used: existing.driver_used + (isDriver ? 1 : 0),
    control_used: existing.control_used + (isDriver ? 0 : 1),
    penalties: existing.penalties + (isPenalty ? 1 : 0),
    avg_score: (existing.avg_score * existing.rounds_played + holeData.score) / newRoundsPlayed,
  };
}

// ---------- 副作用函数：更新数据库 ----------

export async function updateLearningAfterRound(
  userId: string,
  roundId: string,
): Promise<void> {
  // 1. 获取轮次信息（取 course_tee_id）
  const round = await getRoundById(userId, roundId);
  if (!round) throw new Error('Round not found');

  // 2. 获取该轮次所有洞的数据
  const roundHoles = await getRoundHoles(roundId);

  // 3. 获取球员在这个 tee 台的现有历史
  const existingHistory = await getPlayerHoleHistory(userId, round.course_tee_id);

  // 4. 对每个有 score 的洞更新历史统计
  for (const hole of roundHoles) {
    if (hole.score === null) continue;

    const existing = existingHistory.find(h => h.hole_number === hole.hole_number);
    const existingData: HistoryData | null = existing
      ? {
          rounds_played: existing.rounds_played,
          driver_used: existing.driver_used,
          control_used: existing.control_used,
          penalties: existing.penalties,
          avg_score: existing.avg_score ?? 0,
        }
      : null;

    const holeData: HoleData = {
      tee_club: hole.tee_club,
      tee_result: hole.tee_result,
      score: hole.score,
    };

    const updated = computeHistoryUpdate(existingData, holeData);

    await updatePlayerHoleHistory(
      userId,
      round.course_tee_id,
      hole.hole_number,
      updated,
    );
  }
}
