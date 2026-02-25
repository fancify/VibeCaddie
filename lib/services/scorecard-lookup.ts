// 球场记分卡查找服务
// 数字数据：GolfCourseAPI（权威来源）
// 洞描述：Google Custom Search + LLM 提取（仅提取，不生成）

import { callLLM, HOLE_NOTES_EXTRACTION_PROMPT } from './llm';

// ---------- Types ----------

export interface LookupHole {
  hole_number: number;
  par: number;
  yardage: number;
  si: number;
  hole_note?: string;
}

export interface LookupTee {
  tee_name: string;
  tee_color: string;
  par_total: number;
  course_rating?: number;
  slope_rating?: number;
  holes: LookupHole[];
}

export interface LookupResult {
  course_name: string;
  location: string;
  tees: LookupTee[];
  confidence: 'high' | 'medium' | 'low';
  scorecard_source: 'golfcourseapi';
  notes_source_url?: string;
}

// ---------- GolfCourseAPI ----------

interface GolfCourseAPIHole {
  par: number;
  yardage: number;
  handicap: number; // = SI（stroke index）
}

interface GolfCourseAPITee {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  par_total: number;
  holes: GolfCourseAPIHole[];
}

interface GolfCourseAPICourse {
  id: number;
  club_name: string;
  course_name: string;
  location: { city?: string; state?: string; country?: string };
  tees: {
    male: GolfCourseAPITee[];
    female: GolfCourseAPITee[];
  };
}

async function searchGolfCourseAPI(name: string): Promise<GolfCourseAPICourse | null> {
  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    console.warn('[scorecard-lookup] GOLF_COURSE_API_KEY not set');
    return null;
  }

  try {
    const url = `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[scorecard-lookup] GolfCourseAPI error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const courses = (data.courses ?? []) as GolfCourseAPICourse[];
    return courses.length > 0 ? courses[0] : null;
  } catch {
    return null;
  }
}

function mapGolfCourseAPITees(apiCourse: GolfCourseAPICourse): LookupTee[] {
  const allTees: GolfCourseAPITee[] = [
    ...(apiCourse.tees?.male ?? []),
    ...(apiCourse.tees?.female ?? []),
  ];

  return allTees
    .filter((t) => Array.isArray(t.holes) && t.holes.length === 18)
    .map((t) => ({
      tee_name: t.tee_name,
      tee_color: t.tee_name,
      par_total: t.par_total ?? t.holes.reduce((s, h) => s + h.par, 0),
      course_rating: t.course_rating || undefined,
      slope_rating: t.slope_rating || undefined,
      holes: t.holes.map((h, idx) => ({
        hole_number: idx + 1,
        par: h.par,
        yardage: h.yardage,
        si: h.handicap,
      })),
    }));
}

// ---------- HTML → Text ----------

function stripHtmlToText(html: string): string {
  return html
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- Google Custom Search ----------

interface SearchItem {
  link: string;
  title: string;
  snippet: string;
}

async function googleSearch(query: string, numResults = 3): Promise<SearchItem[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) return [];

  const url =
    `https://www.googleapis.com/customsearch/v1` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${numResults}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as SearchItem[];
  } catch {
    return [];
  }
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VibeCaddie/1.0 (golf scorecard lookup)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    return stripHtmlToText(html).slice(0, 15000);
  } catch {
    return '';
  }
}

// ---------- Hole Descriptions ----------

/** Google 搜索 + LLM 提取洞描述文字（仅提取，不生成） */
async function fetchHoleDescriptions(
  courseName: string,
  location?: string,
): Promise<{ sourceUrl?: string; notes: Record<number, string> }> {
  const loc = location || '';
  const items = await googleSearch(
    `${courseName} ${loc} hole by hole guide review descriptions`.trim(),
    3,
  );

  if (items.length === 0) return { notes: {} };

  const sourceUrl = items[0].link;
  const topUrls = [...new Set(items.map((i) => i.link))].slice(0, 2);
  const snippets = items.map((i) => `[${i.title}]\n${i.snippet}`).join('\n\n');

  const pageResults = await Promise.allSettled(topUrls.map(fetchPageText));
  const pageTexts = pageResults
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter(Boolean);

  const webContent = [
    '=== SEARCH SNIPPETS ===',
    snippets,
    ...pageTexts.map((t, i) => `=== PAGE ${i + 1}: ${topUrls[i]} ===\n${t}`),
  ].join('\n\n');

  try {
    const response = await callLLM(
      HOLE_NOTES_EXTRACTION_PROMPT,
      `Golf course: ${courseName}\n\nContent:\n${webContent}`,
      { max_tokens: 2000, temperature: 0 },
    );

    let jsonStr = response.content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (!parsed.notes_found || !Array.isArray(parsed.holes)) return { notes: {} };

    const notes: Record<number, string> = {};
    for (const h of parsed.holes) {
      if (h.note && typeof h.note === 'string') {
        notes[h.hole_number] = h.note;
      }
    }

    const hasNotes = Object.keys(notes).length > 0;
    return { sourceUrl: hasNotes ? sourceUrl : undefined, notes };
  } catch {
    return { notes: {} };
  }
}

// ---------- Main Entry ----------

/** 查找球场记分卡：GolfCourseAPI 获取数字 + Google+LLM 获取洞描述 */
export async function lookupCourseScorecard(
  name: string,
  location?: string,
): Promise<LookupResult> {
  // 1. GolfCourseAPI 查找（数字权威来源）
  const apiCourse = await searchGolfCourseAPI(name);
  if (!apiCourse) {
    throw new Error('Course not found in database — please add manually.');
  }

  // 2. 映射 tee 数据
  const tees = mapGolfCourseAPITees(apiCourse);
  if (tees.length === 0) {
    throw new Error('Course found but no complete tee data available — please add manually.');
  }

  // 3. 并行获取洞描述（仅描述性文字，不影响数字）
  const { sourceUrl: notesUrl, notes } = await fetchHoleDescriptions(
    apiCourse.club_name || name,
    location,
  );

  // 4. 将 notes 合并到每个 tee 的洞数据
  if (Object.keys(notes).length > 0) {
    for (const tee of tees) {
      for (const hole of tee.holes) {
        const note = notes[hole.hole_number];
        if (note) hole.hole_note = note;
      }
    }
  }

  // 5. 组装位置字符串
  const loc = apiCourse.location;
  const locationStr = [loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ');

  const courseName = apiCourse.club_name
    ? apiCourse.course_name
      ? `${apiCourse.club_name} — ${apiCourse.course_name}`
      : apiCourse.club_name
    : name;

  return {
    course_name: courseName,
    location: locationStr || location || '',
    tees,
    confidence: 'high',
    scorecard_source: 'golfcourseapi',
    notes_source_url: notesUrl,
  };
}
