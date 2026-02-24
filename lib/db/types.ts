// ============================================================
// Shared Tables (球场数据)
// ============================================================

export interface Course {
  id: string;
  name: string;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  course_note: string | null;
  created_at: string;
}

export interface CourseTee {
  id: string;
  course_id: string;
  tee_name: string;
  tee_color: string | null;
  par_total: number;
  course_rating: number | null;
  slope_rating: number | null;
  created_at: string;
}

export interface CourseHole {
  id: string;
  course_tee_id: string;
  hole_number: number;
  par: number;
  yardage: number;
  si: number | null;
  hole_note: string | null;
}

export interface HoleHazard {
  id: string;
  course_hole_id: string;
  side: 'L' | 'R' | 'C' | null;
  type: 'water' | 'bunker' | 'trees' | 'OOB' | null;
  start_yards: number | null;
  end_yards: number | null;
  note: string | null;
}

// ============================================================
// Private Tables (用户私有数据)
// ============================================================

export interface PlayerProfile {
  user_id: string;
  name: string;
  sex: string | null;
  age: number | null;
  handicap_index: number | null;
  vibecaddie_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerBagClub {
  id: string;
  user_id: string;
  club_code: string;
  club_label: string | null;
  enabled: boolean;
}

export interface PlayerClubDistance {
  id: string;
  user_id: string;
  club_code: string;
  typical_carry_yards: number | null;
  updated_at: string;
}

export interface PreRoundBriefing {
  id: string;
  user_id: string;
  course_tee_id: string;
  play_date: string;
  briefing_json: BriefingJson;
  created_at: string;
}

export interface Round {
  id: string;
  user_id: string;
  course_tee_id: string;
  played_date: string;
  total_score: number | null;
  recap_text: string | null;
  created_at: string;
}

export interface RoundHole {
  id: string;
  round_id: string;
  hole_number: number;
  tee_club: string;
  tee_result: 'FW' | 'L' | 'R' | 'PEN';
  clubs_used: string[] | null;
  score: number | null;
  putts: number | null;
  gir: boolean | null;
}

export interface PlayerHoleHistory {
  user_id: string;
  course_tee_id: string;
  hole_number: number;
  rounds_played: number;
  driver_used: number;
  control_used: number;
  penalties: number;
  avg_score: number | null;
}

// ============================================================
// Briefing JSON 结构
// ============================================================

export interface BriefingJson {
  control_holes: number[];
  driver_ok_holes: number[];
  avoid_side: 'left' | 'right' | 'none';
  display_text: string;
  hole_strategies?: Array<{
    hole_number: number;
    decision: string;
    reason: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
}
