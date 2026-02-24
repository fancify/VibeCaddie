// 赛后回顾生成服务

import { callLLM, RECAP_SYSTEM_PROMPT } from './llm';
import { updateLearningAfterRound } from './learning';
import { getRoundById, getRoundHoles, saveRecapText } from '@/lib/db/rounds';
import { getBriefingForRound } from '@/lib/db/briefings';
import { getPlayerHoleHistory } from '@/lib/db/players';
import { getCourseHoles } from '@/lib/db/courses';
import type { RoundHole, CourseHole, PlayerHoleHistory, BriefingJson } from '@/lib/db/types';

// ---------- 主函数 ----------

export async function generateRecap(
  userId: string,
  roundId: string,
): Promise<string> {
  // 1. 获取轮次 + 洞数据
  const round = await getRoundById(userId, roundId);
  if (!round) throw new Error('Round not found');
  const roundHoles = await getRoundHoles(roundId);

  // 2. 获取球场洞信息（par 等）
  const courseHoles = await getCourseHoles(round.course_tee_id);

  // 3. 查找匹配的赛前简报（同用户 + 同 tee + 同日期）
  const briefing = await getBriefingForRound(userId, round.course_tee_id, round.played_date);

  // 4. 如果有简报，构建计划 vs 实际对比
  let comparison = '';
  if (briefing?.briefing_json) {
    const strategies = briefing.briefing_json.hole_strategies || [];
    comparison = buildComparison(strategies, roundHoles, courseHoles);
  }

  // 5. 获取历史趋势（需要 2+ 轮）
  const history = await getPlayerHoleHistory(userId, round.course_tee_id);
  const maxRounds = Math.max(...history.map(h => h.rounds_played), 0);
  let trends = '';
  if (maxRounds >= 2) {
    trends = buildTrendsSection(history);
  }

  // 6. 构建 LLM 提示词
  const totalScore = round.total_score || roundHoles.reduce((sum, h) => sum + (h.score || 0), 0);
  const fwCount = roundHoles.filter(h => h.tee_result === 'FW').length;
  const penCount = roundHoles.filter(h => h.tee_result === 'OB').length;
  const girCount = roundHoles.filter(h => h.approach_distance === 'GIR').length;

  let prompt = `Generate a post-round recap.\n\n`;
  prompt += `## Round Summary\n`;
  prompt += `Total score: ${totalScore}\n`;
  prompt += `Fairways hit: ${fwCount} out of ${roundHoles.length}\n`;
  prompt += `Greens in regulation: ${girCount} out of ${roundHoles.length}\n`;
  prompt += `OB/penalties: ${penCount}\n\n`;

  prompt += `## Per-Hole Results\n`;
  for (const hole of roundHoles) {
    const courseHole = courseHoles.find(ch => ch.hole_number === hole.hole_number);
    prompt += `Hole ${hole.hole_number}: Par ${courseHole?.par || '?'}, Tee: ${hole.tee_club} (${hole.tee_result}), Score: ${hole.score || '?'}`;
    if (hole.approach_distance) {
      const dir = hole.approach_direction ? `/${hole.approach_direction}` : '';
      prompt += `, Approach: ${hole.approach_distance}${dir}`;
    }
    if (hole.putts !== null) prompt += `, Putts: ${hole.putts}`;
    prompt += '\n';
  }

  if (comparison) {
    prompt += `\n## Plan vs Play\n${comparison}\n`;
  }

  if (trends) {
    prompt += `\n## Course History (${maxRounds}+ rounds)\n${trends}\n`;
  }

  // 7. 调用 LLM
  const response = await callLLM(RECAP_SYSTEM_PROMPT, prompt);

  // 8. 存储 recap 到数据库
  await saveRecapText(userId, roundId, response.content);

  // 9. 触发学习更新
  await updateLearningAfterRound(userId, roundId);

  return response.content;
}

// ---------- 辅助函数 ----------

/**
 * 对比赛前策略计划 vs 实际执行
 */
function buildComparison(
  strategies: NonNullable<BriefingJson['hole_strategies']>,
  roundHoles: RoundHole[],
  courseHoles: CourseHole[],
): string {
  if (strategies.length === 0) return '';

  const lines: string[] = [];

  for (const strategy of strategies) {
    const actual = roundHoles.find(h => h.hole_number === strategy.hole_number);
    if (!actual) continue;

    const courseHole = courseHoles.find(ch => ch.hole_number === strategy.hole_number);
    const plannedClub = strategy.decision.includes('control') ? 'Control club' : 'Driver';
    const actualClub = actual.tee_club === 'D' ? 'Driver' : actual.tee_club;

    let line = `Hole ${strategy.hole_number} (Par ${courseHole?.par || '?'}): `;
    line += `Planned ${plannedClub}, Used ${actualClub}. `;
    line += `Result: ${actual.tee_result}`;
    if (actual.score !== null) line += `, Score: ${actual.score}`;
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * 从历史数据构建趋势摘要
 */
function buildTrendsSection(history: PlayerHoleHistory[]): string {
  const lines: string[] = [];

  // 总体统计
  const totalPenalties = history.reduce((sum, h) => sum + h.penalties, 0);
  const totalDriverUsed = history.reduce((sum, h) => sum + h.driver_used, 0);
  const totalControlUsed = history.reduce((sum, h) => sum + h.control_used, 0);
  const totalRounds = Math.max(...history.map(h => h.rounds_played), 0);

  lines.push(`Total rounds on this course: ${totalRounds}`);
  lines.push(`Driver usage across holes: ${totalDriverUsed}, Control club usage: ${totalControlUsed}`);

  if (totalPenalties > 0) {
    lines.push(`Total penalties accumulated: ${totalPenalties}`);
    // 找出罚杆最多的洞
    const troubleHoles = history
      .filter(h => h.penalties > 0)
      .sort((a, b) => b.penalties - a.penalties)
      .slice(0, 3);
    if (troubleHoles.length > 0) {
      const troubleList = troubleHoles
        .map(h => `Hole ${h.hole_number} (${h.penalties} penalties in ${h.rounds_played} rounds)`)
        .join(', ');
      lines.push(`Trouble holes: ${troubleList}`);
    }
  }

  // 平均分最高和最低的洞
  const holesWithAvg = history.filter(h => h.avg_score !== null && h.rounds_played >= 2);
  if (holesWithAvg.length > 0) {
    const sorted = [...holesWithAvg].sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0));
    const hardest = sorted[0];
    const easiest = sorted[sorted.length - 1];
    if (hardest) {
      lines.push(`Hardest hole: Hole ${hardest.hole_number} (avg ${hardest.avg_score?.toFixed(1)})`);
    }
    if (easiest && easiest.hole_number !== hardest?.hole_number) {
      lines.push(`Easiest hole: Hole ${easiest.hole_number} (avg ${easiest.avg_score?.toFixed(1)})`);
    }
  }

  return lines.join('\n');
}
