import { query } from './client';
import { Course, CourseTee, CourseHole, HoleHazard } from './types';

/**
 * 模糊搜索球场名称 (pg_trgm similarity)
 */
export async function searchCourses(searchTerm: string): Promise<Course[]> {
  // 去掉变音符号和特殊字符，方便匹配
  const normalized = searchTerm
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .trim();

  const result = await query<Course>(
    `SELECT id, name, location_text, latitude, longitude, course_note, created_at,
       similarity(
         lower(regexp_replace(regexp_replace(name, '[\u0300-\u036f]', '', 'g'), '[^\\w\\s]', '', 'g')),
         $1
       ) AS sim
     FROM courses
     WHERE similarity(lower(name), $1) > 0.3
     ORDER BY sim DESC
     LIMIT 10`,
    [normalized]
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
  hole_note?: string;
}): Promise<CourseHole> {
  const result = await query<CourseHole>(
    `INSERT INTO course_holes (course_tee_id, hole_number, par, yardage, hole_note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (course_tee_id, hole_number)
     DO UPDATE SET par = EXCLUDED.par, yardage = EXCLUDED.yardage, hole_note = EXCLUDED.hole_note
     RETURNING *`,
    [data.course_tee_id, data.hole_number, data.par, data.yardage, data.hole_note ?? null]
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
  side: 'L' | 'R' | 'C';
  type: 'water' | 'bunker' | 'trees' | 'OOB';
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
