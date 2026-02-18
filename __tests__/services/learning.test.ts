import { computeHistoryUpdate } from '@/lib/services/learning';

describe('computeHistoryUpdate', () => {
  test('increments rounds_played', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 1, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 4 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.rounds_played).toBe(4);
  });

  test('increments driver_used when tee_club is D', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 0, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 5 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.driver_used).toBe(3);
    expect(result.control_used).toBe(1);
  });

  test('increments control_used when tee_club is not D', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 0, avg_score: 5.0 };
    const holeData = { tee_club: '3W', tee_result: 'FW', score: 5 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.driver_used).toBe(2);
    expect(result.control_used).toBe(2);
  });

  test('increments penalties when tee_result is PEN', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 1, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'PEN', score: 7 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.penalties).toBe(2);
  });

  test('does not increment penalties for non-PEN results', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 1, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'L', score: 5 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.penalties).toBe(1);
  });

  test('recomputes avg_score as running average', () => {
    const existing = { rounds_played: 3, driver_used: 2, control_used: 1, penalties: 0, avg_score: 5.0 };
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 4 };
    const result = computeHistoryUpdate(existing, holeData);
    expect(result.avg_score).toBeCloseTo(4.75);
  });

  test('handles first round (no existing history)', () => {
    const holeData = { tee_club: 'D', tee_result: 'FW', score: 5 };
    const result = computeHistoryUpdate(null, holeData);
    expect(result.rounds_played).toBe(1);
    expect(result.driver_used).toBe(1);
    expect(result.control_used).toBe(0);
    expect(result.penalties).toBe(0);
    expect(result.avg_score).toBe(5);
  });

  test('handles first round with control club', () => {
    const holeData = { tee_club: '3W', tee_result: 'FW', score: 4 };
    const result = computeHistoryUpdate(null, holeData);
    expect(result.driver_used).toBe(0);
    expect(result.control_used).toBe(1);
  });

  test('handles first round with penalty', () => {
    const holeData = { tee_club: 'D', tee_result: 'PEN', score: 7 };
    const result = computeHistoryUpdate(null, holeData);
    expect(result.penalties).toBe(1);
  });
});
