import { query } from './client';
import { PlayerProfile, PlayerBagClub, PlayerClubDistance, PlayerHoleHistory } from './types';

/**
 * 获取球员档案
 */
export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const result = await query<PlayerProfile>(
    'SELECT * FROM player_profiles WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] ?? null;
}

/**
 * 创建或更新球员档案
 */
export async function upsertPlayerProfile(
  userId: string,
  data: { name: string; sex?: string; age?: number; handicap_index?: number }
): Promise<PlayerProfile> {
  const result = await query<PlayerProfile>(
    `INSERT INTO player_profiles (user_id, name, sex, age, handicap_index)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       sex = EXCLUDED.sex,
       age = EXCLUDED.age,
       handicap_index = EXCLUDED.handicap_index,
       updated_at = now()
     RETURNING *`,
    [userId, data.name, data.sex ?? null, data.age ?? null, data.handicap_index ?? null]
  );
  return result.rows[0];
}

/**
 * 获取球员球包中的球杆
 */
export async function getPlayerBagClubs(userId: string): Promise<PlayerBagClub[]> {
  const result = await query<PlayerBagClub>(
    'SELECT * FROM player_bag_clubs WHERE user_id = $1 ORDER BY club_code',
    [userId]
  );
  return result.rows;
}

/**
 * 插入或更新球包中的球杆
 */
export async function upsertPlayerBagClub(
  userId: string,
  data: { club_code: string; club_label?: string; enabled: boolean }
): Promise<PlayerBagClub> {
  const result = await query<PlayerBagClub>(
    `INSERT INTO player_bag_clubs (user_id, club_code, club_label, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, club_code)
     DO UPDATE SET
       club_label = EXCLUDED.club_label,
       enabled = EXCLUDED.enabled
     RETURNING *`,
    [userId, data.club_code, data.club_label ?? null, data.enabled]
  );
  return result.rows[0];
}

/**
 * 删除球包中的球杆
 */
export async function deletePlayerBagClub(userId: string, clubCode: string): Promise<void> {
  await query(
    'DELETE FROM player_bag_clubs WHERE user_id = $1 AND club_code = $2',
    [userId, clubCode]
  );
}

/**
 * 获取球员各球杆距离数据
 */
export async function getPlayerClubDistances(userId: string): Promise<PlayerClubDistance[]> {
  const result = await query<PlayerClubDistance>(
    'SELECT * FROM player_club_distances WHERE user_id = $1 ORDER BY club_code',
    [userId]
  );
  return result.rows;
}

/**
 * 插入或更新球杆距离
 */
export async function upsertPlayerClubDistance(
  userId: string,
  data: { club_code: string; typical_carry_yards?: number }
): Promise<PlayerClubDistance> {
  const result = await query<PlayerClubDistance>(
    `INSERT INTO player_club_distances (user_id, club_code, typical_carry_yards)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, club_code)
     DO UPDATE SET
       typical_carry_yards = EXCLUDED.typical_carry_yards,
       updated_at = now()
     RETURNING *`,
    [userId, data.club_code, data.typical_carry_yards ?? null]
  );
  return result.rows[0];
}

/**
 * 获取球员在某球场 tee 台的历史打球数据（按洞）
 */
export async function getPlayerHoleHistory(
  userId: string,
  courseTeeId: string
): Promise<PlayerHoleHistory[]> {
  const result = await query<PlayerHoleHistory>(
    'SELECT * FROM player_hole_history WHERE user_id = $1 AND course_tee_id = $2 ORDER BY hole_number',
    [userId, courseTeeId]
  );
  return result.rows;
}
