import { query } from './client';
import { Course, CourseTee, CourseHole, CourseImage, OfficialHoleNote, PlayerHoleNote, HoleHazard } from './types';

/**
 * 模糊搜索球场名称 (pg_trgm similarity)
 */
export async function searchCourses(searchTerm: string): Promise<Course[]> {
  const normalized = searchTerm
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const result = await query<Course>(
    `SELECT id, name, location_text, latitude, longitude, course_note, created_at
     FROM courses
     WHERE lower(name) LIKE '%' || $1 || '%'
        OR similarity(lower(name), $1) > 0.2
     ORDER BY
       CASE WHEN lower(name) LIKE '%' || $1 || '%' THEN 0 ELSE 1 END,
       similarity(lower(name), $1) DESC
     LIMIT 10`,
    [normalized]
  );
  return result.rows;
}

/**
 * 列出所有球场，附带 tee 数量
 */
export async function listCourses(): Promise<(Course & { tee_count: number })[]> {
  const result = await query<Course & { tee_count: number }>(
    `SELECT c.*, COALESCE(t.cnt, 0)::int AS tee_count
     FROM courses c
     LEFT JOIN (SELECT course_id, COUNT(*) AS cnt FROM course_tees GROUP BY course_id) t
       ON t.course_id = c.id
     ORDER BY c.name`
  );
  return result.rows;
}

/**
 * 根据 ID 获取球场
 */
export async function getCourseById(id: string): Promise<Course | null> {
  const result = await query<Course>(
    'SELECT * FROM courses WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

/**
 * 创建球场
 */
export async function createCourse(data: {
  name: string;
  location_text?: string;
  latitude?: number;
  longitude?: number;
  course_note?: string;
}): Promise<Course> {
  const result = await query<Course>(
    `INSERT INTO courses (name, location_text, latitude, longitude, course_note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.name, data.location_text ?? null, data.latitude ?? null, data.longitude ?? null, data.course_note ?? null]
  );
  return result.rows[0];
}

/**
 * 更新球场信息
 */
export async function updateCourse(
  id: string,
  data: { name?: string; location_text?: string; course_note?: string }
): Promise<Course | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.location_text !== undefined) {
    fields.push(`location_text = $${idx++}`);
    values.push(data.location_text);
  }
  if (data.course_note !== undefined) {
    fields.push(`course_note = $${idx++}`);
    values.push(data.course_note);
  }

  if (fields.length === 0) return getCourseById(id);

  values.push(id);
  const result = await query<Course>(
    `UPDATE courses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

/**
 * 获取球场的所有 tee 台
 */
export async function getCourseTees(courseId: string): Promise<CourseTee[]> {
  const result = await query<CourseTee>(
    'SELECT * FROM course_tees WHERE course_id = $1 ORDER BY tee_name',
    [courseId]
  );
  return result.rows;
}

/**
 * 创建 tee 台
 */
export async function createCourseTee(data: {
  course_id: string;
  tee_name: string;
  tee_color?: string;
  par_total: number;
}): Promise<CourseTee> {
  const result = await query<CourseTee>(
    `INSERT INTO course_tees (course_id, tee_name, tee_color, par_total)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.course_id, data.tee_name, data.tee_color ?? null, data.par_total]
  );
  return result.rows[0];
}

/**
 * 更新 tee 台信息（名称、par_total）
 */
export async function updateCourseTee(
  teeId: string,
  data: { tee_name?: string; par_total?: number }
): Promise<CourseTee | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.tee_name !== undefined) {
    fields.push(`tee_name = $${idx}`);
    values.push(data.tee_name);
    // tee_color 同步更新
    fields.push(`tee_color = $${idx}`);
    idx++;
  }
  if (data.par_total !== undefined) {
    fields.push(`par_total = $${idx++}`);
    values.push(data.par_total);
  }

  if (fields.length === 0) return null;

  values.push(teeId);
  const result = await query<CourseTee>(
    `UPDATE course_tees SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

/**
 * 删除 tee 台（级联删除其下的 holes 和 hazards）
 */
export async function deleteCourseTee(teeId: string): Promise<boolean> {
  // 先删 hazards → holes → tee
  await query(
    `DELETE FROM hole_hazards WHERE course_hole_id IN (SELECT id FROM course_holes WHERE course_tee_id = $1)`,
    [teeId]
  );
  await query('DELETE FROM course_holes WHERE course_tee_id = $1', [teeId]);
  const result = await query('DELETE FROM course_tees WHERE id = $1', [teeId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * 获取某个 tee 台的所有球洞信息
 */
export async function getCourseHoles(courseTeeId: string): Promise<CourseHole[]> {
  const result = await query<CourseHole>(
    'SELECT * FROM course_holes WHERE course_tee_id = $1 ORDER BY hole_number',
    [courseTeeId]
  );
  return result.rows;
}

/**
 * 根据实际球洞 par 之和重新计算并更新 tee 的 par_total
 */
export async function recalcTeeParTotal(teeId: string): Promise<void> {
  await query(
    `UPDATE course_tees
     SET par_total = (
       SELECT COALESCE(SUM(par), 0)
       FROM course_holes
       WHERE course_tee_id = $1
     )
     WHERE id = $1`,
    [teeId]
  );
}

/**
 * 插入或更新球洞信息
 */
export async function upsertCourseHole(data: {
  course_tee_id: string;
  hole_number: number;
  par: number;
  yardage: number;
  si?: number;
  hole_note?: string;
}): Promise<CourseHole> {
  const result = await query<CourseHole>(
    `INSERT INTO course_holes (course_tee_id, hole_number, par, yardage, si, hole_note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (course_tee_id, hole_number)
     DO UPDATE SET par = EXCLUDED.par, yardage = EXCLUDED.yardage, si = EXCLUDED.si, hole_note = EXCLUDED.hole_note
     RETURNING *`,
    [data.course_tee_id, data.hole_number, data.par, data.yardage, data.si ?? null, data.hole_note ?? null]
  );
  return result.rows[0];
}

/**
 * 获取某个球洞的所有障碍物
 */
export async function getHoleHazards(courseHoleId: string): Promise<HoleHazard[]> {
  const result = await query<HoleHazard>(
    'SELECT * FROM hole_hazards WHERE course_hole_id = $1',
    [courseHoleId]
  );
  return result.rows;
}

/**
 * 创建球洞障碍物
 */
export async function createHoleHazard(data: {
  course_hole_id: string;
  side?: 'L' | 'R' | 'C' | null;
  type?: 'water' | 'bunker' | 'trees' | 'OOB' | null;
  start_yards?: number;
  end_yards?: number;
  note?: string;
}): Promise<HoleHazard> {
  const result = await query<HoleHazard>(
    `INSERT INTO hole_hazards (course_hole_id, side, type, start_yards, end_yards, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.course_hole_id, data.side, data.type, data.start_yards ?? null, data.end_yards ?? null, data.note ?? null]
  );
  return result.rows[0];
}

/**
 * 删除障碍物
 */
export async function deleteHoleHazard(id: string): Promise<void> {
  await query('DELETE FROM hole_hazards WHERE id = $1', [id]);
}

/**
 * 获取球场所有洞的官方备注，返回以 hole_number 为 key 的 map
 */
export async function getOfficialNotesForCourse(courseId: string): Promise<Record<number, OfficialHoleNote>> {
  const result = await query<OfficialHoleNote>(
    'SELECT * FROM course_hole_official_notes WHERE course_id = $1',
    [courseId]
  );
  const map: Record<number, OfficialHoleNote> = {};
  for (const row of result.rows) {
    map[row.hole_number] = row;
  }
  return map;
}

/**
 * 创建或更新某洞的官方备注
 */
export async function upsertOfficialNote(
  courseId: string,
  holeNumber: number,
  note: string
): Promise<OfficialHoleNote> {
  const result = await query<OfficialHoleNote>(
    `INSERT INTO course_hole_official_notes (course_id, hole_number, note, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (course_id, hole_number)
     DO UPDATE SET note = EXCLUDED.note, updated_at = now()
     RETURNING *`,
    [courseId, holeNumber, note]
  );
  return result.rows[0];
}

/**
 * 删除某洞的官方备注
 */
export async function deleteOfficialNote(courseId: string, holeNumber: number): Promise<void> {
  await query(
    'DELETE FROM course_hole_official_notes WHERE course_id = $1 AND hole_number = $2',
    [courseId, holeNumber]
  );
}

/**
 * 获取某洞的所有玩家备注（附带 is_mine 标记）
 */
export async function getPlayerNotes(
  courseHoleId: string,
  currentUserId: string
): Promise<PlayerHoleNote[]> {
  const result = await query<PlayerHoleNote & { is_mine: boolean }>(
    `SELECT phn.*,
            COALESCE(pp.name, phn.user_name, 'Anonymous') AS user_name,
            (phn.user_id = $2) AS is_mine
     FROM player_hole_notes phn
     LEFT JOIN player_profiles pp ON pp.user_id = phn.user_id
     WHERE phn.course_hole_id = $1
     ORDER BY phn.created_at ASC`,
    [courseHoleId, currentUserId]
  );
  return result.rows;
}

/**
 * 创建或更新玩家备注（每用户每洞唯一）
 */
export async function upsertPlayerNote(data: {
  courseHoleId: string;
  userId: string;
  userName: string;
  note: string;
}): Promise<PlayerHoleNote> {
  const result = await query<PlayerHoleNote>(
    `INSERT INTO player_hole_notes (course_hole_id, user_id, user_name, note, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (course_hole_id, user_id)
     DO UPDATE SET note = EXCLUDED.note, user_name = EXCLUDED.user_name, updated_at = now()
     RETURNING *`,
    [data.courseHoleId, data.userId, data.userName, data.note]
  );
  return result.rows[0];
}

/**
 * 删除玩家备注（仅删自己的）
 */
export async function deletePlayerNote(noteId: string, userId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM player_hole_notes WHERE id = $1 AND user_id = $2',
    [noteId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * 获取球场的所有图片
 */
export async function getCourseImages(courseId: string): Promise<CourseImage[]> {
  const result = await query<CourseImage>(
    'SELECT * FROM course_images WHERE course_id = $1 ORDER BY created_at ASC',
    [courseId]
  );
  return result.rows;
}

/**
 * 添加球场图片
 */
export async function addCourseImage(data: {
  course_id: string;
  data_url: string;
  file_name?: string;
}): Promise<CourseImage> {
  const result = await query<CourseImage>(
    `INSERT INTO course_images (course_id, data_url, file_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.course_id, data.data_url, data.file_name ?? null]
  );
  return result.rows[0];
}

/**
 * 删除球场图片
 */
export async function deleteCourseImage(id: string): Promise<boolean> {
  const result = await query('DELETE FROM course_images WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
