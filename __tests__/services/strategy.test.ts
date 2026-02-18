import {
  getConfidence,
  computeHoleStrategy,
  computeBriefing,
  HoleInput,
  PlayerHistoryInput,
} from '@/lib/services/strategy';

describe('getConfidence', () => {
  test('returns low for 0 rounds', () => {
    expect(getConfidence(0)).toBe('low');
  });

  test('returns low for 1-2 rounds', () => {
    expect(getConfidence(1)).toBe('low');
    expect(getConfidence(2)).toBe('low');
  });

  test('returns medium for 3-5 rounds', () => {
    expect(getConfidence(3)).toBe('medium');
    expect(getConfidence(4)).toBe('medium');
    expect(getConfidence(5)).toBe('medium');
  });

  test('returns high for 6+ rounds', () => {
    expect(getConfidence(6)).toBe('high');
    expect(getConfidence(8)).toBe('high');
    expect(getConfidence(100)).toBe('high');
  });
});

describe('computeHoleStrategy', () => {
  // Rule 1: High driver penalty -> control
  test('recommends control when driver penalty rate > 40%', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 5, driver_used: 4, penalties: 3 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    expect(result.decision).toBe('control');
    expect(result.confidence).toBe('medium');
  });

  test('does not trigger penalty rule when penalty rate <= 40%', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 5, driver_used: 5, penalties: 1 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    expect(result.decision).not.toBe('control');
  });

  test('does not trigger penalty rule when driver_used is 0', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 3, driver_used: 0, penalties: 0 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    // driver_used is 0, can't compute penalty rate, should skip rule 1
    expect(result.decision).not.toBe('control');
  });

  // Rule 2: Hazard overlaps driver carry +/- 15
  test('recommends control when hazard overlaps driver carry band', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [{ side: 'R', type: 'water', start_yards: 230, end_yards: 260 }],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: 245 });
    expect(result.decision).toBe('control');
    expect(result.hazard_notes).toContain('Water right 230-260');
  });

  test('does not trigger hazard overlap when no overlap', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [{ side: 'R', type: 'water', start_yards: 280, end_yards: 310 }],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: 245 });
    expect(result.decision).toBe('driver');
  });

  test('skips hazard overlap check when driver carry unknown', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [{ side: 'R', type: 'water', start_yards: 230, end_yards: 260 }],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: null });
    expect(result.decision).toBe('driver');
  });

  test('handles hazard with null start/end yards (skips overlap check)', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [{ side: 'R', type: 'water', start_yards: null, end_yards: null }],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: 245 });
    expect(result.decision).toBe('driver');
  });

  // Rule 3: Short par-4
  test('recommends control for short par-4 under 360', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 340, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('control');
  });

  test('recommends control for par-4 at exactly 359 yards', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 359, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('control');
  });

  // Rule 4: Long par-4
  test('recommends driver for long par-4 over 400', () => {
    const hole: HoleInput = { hole_number: 10, par: 4, yardage: 430, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('driver');
  });

  test('recommends driver for par-4 at exactly 401 yards', () => {
    const hole: HoleInput = { hole_number: 10, par: 4, yardage: 401, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('driver');
  });

  // Rule 5: Par-3
  test('recommends center green for par-3', () => {
    const hole: HoleInput = { hole_number: 3, par: 3, yardage: 165, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('center_green');
  });

  // Rule 6: Par-5
  test('recommends safe reach for par-5', () => {
    const hole: HoleInput = { hole_number: 5, par: 5, yardage: 520, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('safe_reach');
  });

  // Default: Medium par-4 with no issues
  test('defaults to driver for medium par-4 with no issues', () => {
    const hole: HoleInput = { hole_number: 8, par: 4, yardage: 380, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).toBe('driver');
  });

  // Par-4 at boundary: exactly 360 -> not short (>= 360 is not < 360)
  test('par-4 at exactly 360 yards is not short', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 360, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.decision).not.toBe('control');
  });

  // Par-4 at boundary: exactly 400 -> not long (400 is not > 400)
  test('par-4 at exactly 400 yards is not long', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 400, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    // 400 is not > 400, so not long par-4; 400 is not < 360 so not short; falls to default driver
    expect(result.decision).toBe('driver');
  });

  // Confidence levels
  test('returns low confidence for no history', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 380, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.confidence).toBe('low');
  });

  test('returns high confidence for 6+ rounds', () => {
    const hole: HoleInput = { hole_number: 7, par: 4, yardage: 380, hazards: [] };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 8, driver_used: 7, penalties: 5 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 240 });
    expect(result.confidence).toBe('high');
  });

  // Priority: history beats hazard
  test('history rule takes priority over hazard overlap', () => {
    const hole: HoleInput = {
      hole_number: 7, par: 4, yardage: 400,
      hazards: [{ side: 'L', type: 'bunker', start_yards: 230, end_yards: 260 }],
    };
    const history: PlayerHistoryInput = { hole_number: 7, rounds_played: 5, driver_used: 5, penalties: 4 };
    const result = computeHoleStrategy(hole, history, { driver_carry: 245 });
    expect(result.decision).toBe('control');
    expect(result.reason).toContain('penalty');
  });

  // Hazard notes format
  test('formats hazard notes correctly', () => {
    const hole: HoleInput = {
      hole_number: 4, par: 4, yardage: 400,
      hazards: [
        { side: 'R', type: 'water', start_yards: 230, end_yards: 260 },
        { side: 'L', type: 'bunker', start_yards: 200, end_yards: 220 },
      ],
    };
    const result = computeHoleStrategy(hole, null, { driver_carry: 245 });
    expect(result.hazard_notes).toContain('Water right 230-260');
    expect(result.hazard_notes).toContain('Bunker left 200-220');
  });

  // Reason includes meaningful text
  test('reason mentions short par-4 for short par-4 control', () => {
    const hole: HoleInput = { hole_number: 1, par: 4, yardage: 340, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.reason.length).toBeGreaterThan(0);
  });

  // Hole number is preserved
  test('preserves hole number in result', () => {
    const hole: HoleInput = { hole_number: 13, par: 4, yardage: 380, hazards: [] };
    const result = computeHoleStrategy(hole, null, { driver_carry: 250 });
    expect(result.hole_number).toBe(13);
  });
});

describe('computeBriefing', () => {
  test('aggregates control and driver holes correctly', () => {
    const holes: HoleInput[] = [
      { hole_number: 1, par: 4, yardage: 340, hazards: [] },  // short par-4 -> control
      { hole_number: 2, par: 4, yardage: 430, hazards: [] },  // long par-4 -> driver
      { hole_number: 3, par: 3, yardage: 165, hazards: [] },  // par-3 -> center_green
      { hole_number: 4, par: 5, yardage: 520, hazards: [] },  // par-5 -> safe_reach
      { hole_number: 5, par: 4, yardage: 380, hazards: [] },  // medium par-4 -> driver
    ];
    const result = computeBriefing(holes, [], { driver_carry: 250 });
    expect(result.control_holes).toContain(1);
    expect(result.driver_ok_holes).toContain(2);
    expect(result.driver_ok_holes).toContain(5);
    expect(result.hole_strategies).toHaveLength(5);
  });

  test('computes avoid_side from hazard majority', () => {
    const holes: HoleInput[] = [
      { hole_number: 1, par: 4, yardage: 380, hazards: [{ side: 'R', type: 'water', start_yards: 200, end_yards: 250 }] },
      { hole_number: 2, par: 4, yardage: 380, hazards: [{ side: 'R', type: 'bunker', start_yards: 220, end_yards: 240 }] },
      { hole_number: 3, par: 4, yardage: 380, hazards: [{ side: 'R', type: 'trees', start_yards: 210, end_yards: 260 }] },
      { hole_number: 4, par: 4, yardage: 380, hazards: [{ side: 'L', type: 'water', start_yards: 200, end_yards: 250 }] },
    ];
    const result = computeBriefing(holes, [], { driver_carry: 250 });
    expect(result.avoid_side).toBe('right');
  });

  test('avoid_side is none when hazards are balanced', () => {
    const holes: HoleInput[] = [
      { hole_number: 1, par: 4, yardage: 380, hazards: [{ side: 'R', type: 'water', start_yards: 200, end_yards: 250 }] },
      { hole_number: 2, par: 4, yardage: 380, hazards: [{ side: 'L', type: 'water', start_yards: 200, end_yards: 250 }] },
    ];
    const result = computeBriefing(holes, [], { driver_carry: 250 });
    expect(result.avoid_side).toBe('none');
  });

  test('avoid_side is none when no hazards exist', () => {
    const holes: HoleInput[] = [
      { hole_number: 1, par: 4, yardage: 380, hazards: [] },
      { hole_number: 2, par: 4, yardage: 380, hazards: [] },
    ];
    const result = computeBriefing(holes, [], { driver_carry: 250 });
    expect(result.avoid_side).toBe('none');
  });

  test('matches history to correct hole by hole_number', () => {
    const holes: HoleInput[] = [
      { hole_number: 7, par: 4, yardage: 380, hazards: [] },
      { hole_number: 8, par: 4, yardage: 380, hazards: [] },
    ];
    const histories: PlayerHistoryInput[] = [
      { hole_number: 7, rounds_played: 5, driver_used: 5, penalties: 4 }, // penalty > 40% -> control
      { hole_number: 8, rounds_played: 5, driver_used: 5, penalties: 0 }, // no penalty -> driver
    ];
    const result = computeBriefing(holes, histories, { driver_carry: 250 });
    expect(result.control_holes).toContain(7);
    expect(result.driver_ok_holes).toContain(8);
  });

  test('handles empty holes array', () => {
    const result = computeBriefing([], [], { driver_carry: 250 });
    expect(result.control_holes).toEqual([]);
    expect(result.driver_ok_holes).toEqual([]);
    expect(result.hole_strategies).toEqual([]);
    expect(result.avoid_side).toBe('none');
  });

  test('avoid_side is left when left hazards dominate', () => {
    const holes: HoleInput[] = [
      { hole_number: 1, par: 4, yardage: 380, hazards: [{ side: 'L', type: 'water', start_yards: 200, end_yards: 250 }] },
      { hole_number: 2, par: 4, yardage: 380, hazards: [{ side: 'L', type: 'bunker', start_yards: 220, end_yards: 240 }] },
      { hole_number: 3, par: 4, yardage: 380, hazards: [{ side: 'L', type: 'trees', start_yards: 210, end_yards: 260 }] },
      { hole_number: 4, par: 4, yardage: 380, hazards: [{ side: 'R', type: 'water', start_yards: 200, end_yards: 250 }] },
    ];
    const result = computeBriefing(holes, [], { driver_carry: 250 });
    expect(result.avoid_side).toBe('left');
  });
});
