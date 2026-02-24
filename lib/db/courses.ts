import { query } from './client';
import { Course, CourseTee, CourseHole, HoleHazard } from './types';

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
  course_rating?: number;
  slope_rating?: number;
}): Promise<CourseTee> {
  const result = await query<CourseTee>(
    `INSERT INTO course_tees (course_id, tee_name, tee_color, par_total, course_rating, slope_rating)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.course_id, data.tee_name, data.tee_color ?? null, data.par_total, data.course_rating ?? null, data.slope_rating ?? null]
  );
  return result.rows[0];
}

/**
 * 更新 tee 台信息（名称、par_total、course_rating、slope_rating）
 */
export async function updateCourseTee(
  teeId: string,
  data: { tee_name?: string; par_total?: number; course_rating?: number | null; slope_rating?: number | null }
): Promise<CourseTee | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.tee_name !== undefined) {
    fields.push(`tee_name = $${idx++}`);
    values.push(data.tee_name);
    // tee_color 与 tee_name 同步
    fields.push(`tee_color = $${idx++}`);
    values.push(data.tee_name);
  }
  if (data.par_total !== undefined) {
    fields.push(`par_total = $${idx++}`);
    values.push(data.par_total);
  }
  if (data.course_rating !== undefined) {
    fields.push(`course_rating = $${idx++}`);
    values.push(data.course_rating);
  }
  if (data.slope_rating !== undefined) {
    fields.push(`slope_rating = $${idx++}`);
    values.push(data.slope_rating);
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
