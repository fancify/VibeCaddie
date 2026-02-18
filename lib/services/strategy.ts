// 策略引擎 — 纯业务逻辑，无数据库/API依赖

export type Confidence = 'low' | 'medium' | 'high';
export type TeeDecision = 'driver' | 'control' | 'center_green' | 'safe_reach';

export interface HoleStrategy {
  hole_number: number;
  decision: TeeDecision;
  reason: string;
  confidence: Confidence;
  hazard_notes: string[];
}

export interface BriefingData {
  control_holes: number[];
  driver_ok_holes: number[];
  avoid_side: 'left' | 'right' | 'none';
  hole_strategies: HoleStrategy[];
}

export interface HoleInput {
  hole_number: number;
  par: number;
  yardage: number;
  hazards: Array<{
    side: string;
    type: string;
    start_yards: number | null;
    end_yards: number | null;
  }>;
}

export interface PlayerHistoryInput {
  hole_number: number;
  rounds_played: number;
  driver_used: number;
  penalties: number;
}

export interface PlayerDistanceInput {
  driver_carry: number | null;
}

/**
 * 根据打过的轮次数决定置信度
 */
export function getConfidence(roundsPlayed: number): Confidence {
  if (roundsPlayed <= 2) return 'low';
  if (roundsPlayed <= 5) return 'medium';
  return 'high';
}

/**
 * 格式化hazard备注：类型首字母大写 + side小写映射 + 码数范围
 */
function formatHazardNote(hazard: {
  side: string;
  type: string;
  start_yards: number | null;
  end_yards: number | null;
}): string {
  const type = hazard.type.charAt(0).toUpperCase() + hazard.type.slice(1).toLowerCase();
  const sideMap: Record<string, string> = { R: 'right', L: 'left' };
  const side = sideMap[hazard.side] ?? hazard.side.toLowerCase();

  if (hazard.start_yards !== null && hazard.end_yards !== null) {
    return `${type} ${side} ${hazard.start_yards}-${hazard.end_yards}`;
  }
  return `${type} ${side}`;
}

/**
 * 检查hazard的码数范围是否和driver carry +/- 15重叠
 */
function hazardOverlapsCarry(
  hazard: { start_yards: number | null; end_yards: number | null },
  driverCarry: number,
): boolean {
  if (hazard.start_yards === null || hazard.end_yards === null) return false;
  const bandLow = driverCarry - 15;
  const bandHigh = driverCarry + 15;
  // 两个区间重叠条件：start <= bandHigh && end >= bandLow
  return hazard.start_yards <= bandHigh && hazard.end_yards >= bandLow;
}

/**
 * 为单个洞计算策略，按优先级链处理
 */
export function computeHoleStrategy(
  hole: HoleInput,
  history: PlayerHistoryInput | null,
  playerDistance: PlayerDistanceInput,
): HoleStrategy {
  const confidence: Confidence = history ? getConfidence(history.rounds_played) : 'low';
  const hazardNotes = hole.hazards.map(formatHazardNote);

  // Rule 1: 高罚杆率 -> control
  if (history && history.driver_used > 0) {
    const penaltyRate = history.penalties / history.driver_used;
    if (penaltyRate > 0.4) {
      return {
        hole_number: hole.hole_number,
        decision: 'control',
        reason: 'Driver has brought trouble here — high penalty rate',
        confidence,
        hazard_notes: hazardNotes,
      };
    }
  }

  // Rule 2: hazard和driver carry重叠 -> control
  if (playerDistance.driver_carry !== null) {
    const overlapping = hole.hazards.some((h) =>
      hazardOverlapsCarry(h, playerDistance.driver_carry as number),
    );
    if (overlapping) {
      return {
        hole_number: hole.hole_number,
        decision: 'control',
        reason: 'Hazard sits right in your driver landing zone — lay up to stay safe',
        confidence,
        hazard_notes: hazardNotes,
      };
    }
  }

  // Rule 3: 短par-4 -> control
  if (hole.par === 4 && hole.yardage < 360) {
    return {
      hole_number: hole.hole_number,
      decision: 'control',
      reason: 'Short par-4 — no need to bomb it, position for a wedge in',
      confidence,
      hazard_notes: hazardNotes,
    };
  }

  // Rule 4: 长par-4 -> driver
  if (hole.par === 4 && hole.yardage > 400) {
    return {
      hole_number: hole.hole_number,
      decision: 'driver',
      reason: 'Long par-4 — you need the distance off the tee',
      confidence,
      hazard_notes: hazardNotes,
    };
  }

  // Rule 5: par-3 -> center_green
  if (hole.par === 3) {
    return {
      hole_number: hole.hole_number,
      decision: 'center_green',
      reason: 'Par-3 — aim for the middle of the green and take your par',
      confidence,
      hazard_notes: hazardNotes,
    };
  }

  // Rule 6: par-5 -> safe_reach
  if (hole.par === 5) {
    return {
      hole_number: hole.hole_number,
      decision: 'safe_reach',
      reason: 'Par-5 — play smart and reach in regulation without the hero shot',
      confidence,
      hazard_notes: hazardNotes,
    };
  }

  // Default: driver
  return {
    hole_number: hole.hole_number,
    decision: 'driver',
    reason: 'Fairway is open — let it rip',
    confidence,
    hazard_notes: hazardNotes,
  };
}

/**
 * 为整场球生成策略简报
 */
export function computeBriefing(
  holes: HoleInput[],
  histories: PlayerHistoryInput[],
  playerDistance: PlayerDistanceInput,
): BriefingData {
  // 按hole_number建立history索引
  const historyMap = new Map<number, PlayerHistoryInput>();
  for (const h of histories) {
    historyMap.set(h.hole_number, h);
  }

  const holeStrategies = holes.map((hole) => {
    const history = historyMap.get(hole.hole_number) ?? null;
    return computeHoleStrategy(hole, history, playerDistance);
  });

  const controlHoles = holeStrategies
    .filter((s) => s.decision === 'control')
    .map((s) => s.hole_number);

  const driverOkHoles = holeStrategies
    .filter((s) => s.decision === 'driver')
    .map((s) => s.hole_number);

  // 统计左右hazard数量，计算避让侧
  let leftCount = 0;
  let rightCount = 0;
  for (const hole of holes) {
    for (const hazard of hole.hazards) {
      if (hazard.side === 'L') leftCount++;
      if (hazard.side === 'R') rightCount++;
    }
  }

  const total = leftCount + rightCount;
  let avoidSide: 'left' | 'right' | 'none' = 'none';
  if (total > 0) {
    if (rightCount / total > 0.6) {
      avoidSide = 'right';
    } else if (leftCount / total > 0.6) {
      avoidSide = 'left';
    }
  }

  return {
    control_holes: controlHoles,
    driver_ok_holes: driverOkHoles,
    avoid_side: avoidSide,
    hole_strategies: holeStrategies,
  };
}
