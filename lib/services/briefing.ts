import { computeBriefing, BriefingData, HoleInput, PlayerHistoryInput } from './strategy';
import { callLLM, BRIEFING_SYSTEM_PROMPT } from './llm';
import { getCourseHoles, getHoleHazards } from '@/lib/db/courses';
import { getPlayerClubDistances, getPlayerHoleHistory } from '@/lib/db/players';
import { createBriefing as saveBriefing } from '@/lib/db/briefings';
import { BriefingJson } from '@/lib/db/types';

export async function generateBriefing(
  userId: string,
  courseTeeId: string,
  playDate: string,
): Promise<{ id: string; briefingJson: BriefingJson }> {
  // 1. 获取球洞信息
  const holes = await getCourseHoles(courseTeeId);

  // 2. 并行获取每个洞的障碍物
  const holesWithHazards: HoleInput[] = await Promise.all(
    holes.map(async (h) => {
      const hazards = await getHoleHazards(h.id);
      return {
        hole_number: h.hole_number,
        par: h.par,
        yardage: h.yardage,
        hazards: hazards.map(hz => ({
          side: hz.side,
          type: hz.type,
          start_yards: hz.start_yards,
          end_yards: hz.end_yards,
        })),
      };
    })
  );

  // 3. 获取球员距离数据（取 driver carry）
  const distances = await getPlayerClubDistances(userId);
  const driverDist = distances.find(d => d.club_code === 'D');
  const playerDistance = { driver_carry: driverDist?.typical_carry_yards ?? null };

  // 4. 获取球员在这个 tee 台的历史数据
  const histories = await getPlayerHoleHistory(userId, courseTeeId);
  const historyInputs: PlayerHistoryInput[] = histories.map(h => ({
    hole_number: h.hole_number,
    rounds_played: h.rounds_played,
    driver_used: h.driver_used,
    penalties: h.penalties,
  }));

  // 5. 运行策略引擎
  const briefingData: BriefingData = computeBriefing(holesWithHazards, historyInputs, playerDistance);

  // 6. 组装 LLM 提示词
  const userPrompt = assembleBriefingPrompt(briefingData, holesWithHazards, historyInputs);

  // 7. 调用 LLM
  const llmResponse = await callLLM(BRIEFING_SYSTEM_PROMPT, userPrompt);

  // 8. 构建 briefing JSON
  const briefingJson: BriefingJson = {
    control_holes: briefingData.control_holes,
    driver_ok_holes: briefingData.driver_ok_holes,
    avoid_side: briefingData.avoid_side,
    display_text: llmResponse.content,
    hole_strategies: briefingData.hole_strategies.map(s => ({
      hole_number: s.hole_number,
      decision: s.decision,
      reason: s.reason,
      confidence: s.confidence,
    })),
  };

  // 9. 保存到数据库
  const saved = await saveBriefing(userId, {
    course_tee_id: courseTeeId,
    play_date: playDate,
    briefing_json: briefingJson,
  });

  return { id: saved.id, briefingJson };
}

function assembleBriefingPrompt(
  data: BriefingData,
  holes: HoleInput[],
  histories: PlayerHistoryInput[],
): string {
  let prompt = `Generate a pre-round briefing for an ${holes.length}-hole round.\n\n`;

  prompt += `## Strategy Summary\n`;
  prompt += `Driver OK holes: ${data.driver_ok_holes.join(', ') || 'none'}\n`;
  prompt += `Control club holes: ${data.control_holes.join(', ') || 'none'}\n`;
  prompt += `Avoid side: ${data.avoid_side}\n\n`;

  prompt += `## Per-Hole Details\n`;
  for (const strategy of data.hole_strategies) {
    const hole = holes.find(h => h.hole_number === strategy.hole_number);
    prompt += `Hole ${strategy.hole_number}: Par ${hole?.par}, ${hole?.yardage} yds — ${strategy.decision} (${strategy.confidence} confidence). ${strategy.reason}`;
    if (strategy.hazard_notes.length > 0) {
      prompt += ` Hazards: ${strategy.hazard_notes.join(', ')}`;
    }
    prompt += '\n';
  }

  if (histories.length > 0) {
    prompt += `\n## Player History on This Course\n`;
    prompt += `The player has played ${Math.max(...histories.map(h => h.rounds_played))} rounds here before.\n`;
    const troubleHoles = histories.filter(h => h.penalties > 0);
    if (troubleHoles.length > 0) {
      prompt += `Trouble holes (penalties): ${troubleHoles.map(h => `Hole ${h.hole_number} (${h.penalties} penalties in ${h.rounds_played} rounds)`).join(', ')}\n`;
    }
  }

  return prompt;
}
