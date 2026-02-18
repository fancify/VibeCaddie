import { query } from './client';
import { Round, RoundHole, PlayerHoleHistory } from './types';

/**
 * 获取球员的所有轮次（带球场名和 tee 名）
 */
export async function getPlayerRounds(
  userId: string
): Promise<(Round & { course_name?: string; tee_name?: string })[]> {
  const result = await query<Round & { course_name?: string; tee_name?: string }>(
    `SELECT r.*, c.name AS course_name, ct.tee_name
     FROM rounds r
     JOIN course_tees ct ON r.course_tee_id = ct.id
     JOIN courses c ON ct.course_id = c.id
     WHERE r.user_id = $1
     ORDER BY r.played_date DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * 根据 ID 获取单个轮次（校验 user_id）
 */
export async function getRoundById(userId: string, roundId: string): Promise<Round | null> {
  const result = await query<Round>(
    'SELECT * FROM rounds WHERE id = $1 AND user_id = $2',
    [roundId, userId]
  );
  return result.rows[0] ?? null;
}

/**
 * 创建新的一轮
 */
export async function createRound(
  userId: string,
  data: { course_tee_id: string; played_date: string }
): Promise<Round> {
  const result = await query<Round>(
    `INSERT INTO rounds (user_id, course_tee_id, played_date)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, data.course_tee_id, data.played_date]
  );
  return result.rows[0];
}

/**
 * 获取某一轮的所有洞数据
 */
export async function getRoundHoles(roundId: string): Promise<RoundHole[]> {
  const result = await query<RoundHole>(
    'SELECT * FROM round_holes WHERE round_id = $1 ORDER BY hole_number',
    [roundId]
  );
  return result.rows;
}

/**
 * 插入或更新某一洞的数据
 */
export async function upsertRoundHole(data: {
  round_id: string;
  hole_number: number;
  tee_club: string;
  tee_result: 'FW' | 'L' | 'R' | 'PEN';
  score?: number;
  putts?: number;
  gir?: boolean;
}): Promise<RoundHole> {
  const result = await query<RoundHole>(
    `INSERT INTO round_holes (round_id, hole_number, tee_club, tee_result, score, putts, gir)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (round_id, hole_number)
     DO UPDATE SET
       tee_club = EXCLUDED.tee_club,
       tee_result = EXCLUDED.tee_result,
       score = EXCLUDED.score,
       putts = EXCLUDED.putts,
       gir = EXCLUDED.gir
     RETURNING *`,
    [
      data.round_id,
      data.hole_number,
      data.tee_club,
      data.tee_result,
      data.score ?? null,
      data.putts ?? null,
      data.gir ?? null,
    ]
  );
  return result.rows[0];
}

/**
 * 更新轮次总杆数
 */
export async function updateRoundTotalScore(
  userId: string,
  roundId: string,
  totalScore: number
): Promise<void> {
  await query(
    'UPDATE rounds SET total_score = $1 WHERE id = $2 AND user_id = $3',
    [totalScore, roundId, userId]
  );
}

/**
 * 更新球员某一洞的历史统计（upsert）
 */
export async function updatePlayerHoleHistory(
  userId: string,
  courseTeeId: string,
  holeNumber: number,
  data: Partial<Omit<PlayerHoleHistory, 'user_id' | 'course_tee_id' | 'hole_number'>>
): Promise<void> {
  await query(
    `INSERT INTO player_hole_history (user_id, course_tee_id, hole_number, rounds_played, driver_used, control_used, penalties, avg_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, course_tee_id, hole_number)
     DO UPDATE SET
       rounds_played = COALESCE($4, player_hole_history.rounds_played),
       driver_used = COALESCE($5, player_hole_history.driver_used),
       control_used = COALESCE($6, player_hole_history.control_used),
       penalties = COALESCE($7, player_hole_history.penalties),
       avg_score = COALESCE($8, player_hole_history.avg_score)`,
    [
      userId,
      courseTeeId,
      holeNumber,
      data.rounds_played ?? 0,
      data.driver_used ?? 0,
      data.control_used ?? 0,
      data.penalties ?? 0,
      data.avg_score ?? null,
    ]
  );
}
