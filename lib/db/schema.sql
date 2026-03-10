-- VibeCaddie 数据库 Schema
-- 运行: psql $DATABASE_URL -f lib/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- SHARED TABLES (球场数据，所有用户共享)
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_text TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  course_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_name_trgm ON courses USING gin(name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS course_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_tees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tee_name TEXT NOT NULL,
  tee_color TEXT,
  par_total INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_tee_id UUID NOT NULL REFERENCES course_tees(id) ON DELETE CASCADE,
  hole_number INT NOT NULL,
  par INT NOT NULL,
  yardage INT NOT NULL,
  si INT,
  hole_note TEXT,
  UNIQUE(course_tee_id, hole_number)
);

CREATE TABLE IF NOT EXISTS course_hole_official_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  note TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, hole_number)
);

CREATE TABLE IF NOT EXISTS player_hole_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_hole_id UUID NOT NULL REFERENCES course_holes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_hole_id, user_id)
);

CREATE TABLE IF NOT EXISTS hole_hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_hole_id UUID NOT NULL REFERENCES course_holes(id) ON DELETE CASCADE,
  side TEXT CHECK (side IN ('L', 'R', 'C')),
  type TEXT CHECK (type IN ('water', 'bunker', 'trees', 'OOB')),
  start_yards INT,
  end_yards INT,
  note TEXT
);

-- ============================================================
-- PRIVATE TABLES (用户私有数据)
-- ============================================================

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  sex TEXT,
  age INT,
  handicap_index DECIMAL(4,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_bag_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  club_code TEXT NOT NULL,
  club_label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, club_code)
);

CREATE TABLE IF NOT EXISTS player_club_distances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE,
  club_code TEXT NOT NULL,
  typical_carry_yards INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, club_code)
);

CREATE TABLE IF NOT EXISTS pre_round_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_tee_id UUID NOT NULL REFERENCES course_tees(id),
  play_date DATE NOT NULL,
  briefing_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_tee_id UUID NOT NULL REFERENCES course_tees(id),
  played_date DATE NOT NULL,
  total_score INT,
  recap_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS round_holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number INT NOT NULL,
  tee_club TEXT NOT NULL,
  tee_result TEXT NOT NULL CHECK (tee_result IN ('FW', 'L', 'R', 'PEN')),
  clubs_used TEXT[],
  score INT,
  putts INT,
  gir BOOLEAN,
  UNIQUE(round_id, hole_number)
);

CREATE TABLE IF NOT EXISTS player_hole_history (
  user_id UUID NOT NULL,
  course_tee_id UUID NOT NULL,
  hole_number INT NOT NULL,
  rounds_played INT NOT NULL DEFAULT 0,
  driver_used INT NOT NULL DEFAULT 0,
  control_used INT NOT NULL DEFAULT 0,
  penalties INT NOT NULL DEFAULT 0,
  avg_score DECIMAL(4,1),
  PRIMARY KEY(user_id, course_tee_id, hole_number)
);
