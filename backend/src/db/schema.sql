CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  target_score INTEGER,
  color TEXT NOT NULL
);

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  duration_seconds INTEGER NOT NULL,
  notes TEXT,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('SAC', 'SAT', 'PRACTICE_SAC', 'PRACTICE_SAT', 'EXAM', 'TASK', 'STUDY_TIME')),
  event_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  recurrence TEXT NOT NULL DEFAULT 'NONE',
  recurrence_until DATE,
  notification_minutes INTEGER NOT NULL DEFAULT 60,
  source TEXT NOT NULL DEFAULT 'manual',
  google_calendar_id TEXT,
  google_event_id TEXT,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  target_study_score INTEGER,
  weekly_hours_target NUMERIC(4,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, subject_id)
);

CREATE TABLE user_gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0,
  xp_balance INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_study_date DATE,
  badges JSONB DEFAULT '[]',
  unlocked_cosmetics JSONB DEFAULT '["midnight"]',
  active_theme TEXT DEFAULT 'midnight',
  active_title TEXT DEFAULT 'year_12_rookie',
  leaderboard_opt_in BOOLEAN DEFAULT FALSE,
  leaderboard_prompted_at TIMESTAMPTZ
);

CREATE TABLE saved_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  model_answer TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT,
  marks INTEGER,
  marking_criteria JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  class_date DATE NOT NULL,
  class_summary TEXT NOT NULL,
  understood TEXT NOT NULL,
  confused TEXT NOT NULL,
  next_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'textbook',
  extracted_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE adaptive_study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  summary TEXT NOT NULL,
  focus_areas JSONB DEFAULT '[]',
  tasks JSONB DEFAULT '[]',
  daily_plan JSONB DEFAULT '[]',
  subject_roadmaps JSONB DEFAULT '[]',
  source_events JSONB DEFAULT '[]',
  checkpoints JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE community_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX study_sessions_user_created_idx ON study_sessions(user_id, created_at);
CREATE INDEX events_user_date_idx ON events(user_id, event_date);
CREATE INDEX saved_questions_user_created_idx ON saved_questions(user_id, created_at);
CREATE INDEX study_reflections_user_date_idx ON study_reflections(user_id, class_date);
CREATE INDEX study_notes_user_updated_idx ON study_notes(user_id, updated_at);
CREATE INDEX study_resources_user_created_idx ON study_resources(user_id, created_at);
CREATE INDEX adaptive_study_plans_user_created_idx ON adaptive_study_plans(user_id, created_at);
CREATE INDEX user_feedback_user_created_idx ON user_feedback(user_id, created_at);
CREATE INDEX user_feedback_created_idx ON user_feedback(created_at);
CREATE INDEX community_chat_messages_created_idx ON community_chat_messages(created_at);
CREATE INDEX community_chat_messages_user_created_idx ON community_chat_messages(user_id, created_at);

CREATE TABLE user_gift_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  gift_type TEXT NOT NULL,
  gift_id TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX user_gift_messages_user_created_idx ON user_gift_messages(user_id, created_at);
CREATE INDEX user_gift_messages_user_read_idx ON user_gift_messages(user_id, read_at);
