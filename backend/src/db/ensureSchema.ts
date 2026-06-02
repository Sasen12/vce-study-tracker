import { prisma } from "./prismaClient.js";
import { inferSchoolNameFromEmail } from "../utils/schoolEmail.js";

const ensureStudentMemorySchema = async () => {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_memory_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload JSONB DEFAULT '{}',
      importance INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS student_memory_events_user_created_idx ON student_memory_events(user_id, created_at)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS student_memory_events_subject_created_idx ON student_memory_events(subject_id, created_at)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS student_memory_events_type_created_idx ON student_memory_events(event_type, created_at)"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS learning_signals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
      subject_key TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      memory_event_id UUID REFERENCES student_memory_events(id) ON DELETE SET NULL,
      signal_type TEXT NOT NULL,
      topic TEXT,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      evidence TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'medium',
      next_action TEXT,
      weight INTEGER DEFAULT 1,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS learning_signals_user_created_idx ON learning_signals(user_id, created_at)");
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS learning_signals_subject_key_created_idx ON learning_signals(subject_key, created_at)"
  );
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS learning_signals_type_created_idx ON learning_signals(signal_type, created_at)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS learning_signals_memory_event_idx ON learning_signals(memory_event_id)");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_subject_memory (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES user_subjects(id) ON DELETE SET NULL,
      subject_key TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      strengths JSONB DEFAULT '[]',
      weak_areas JSONB DEFAULT '[]',
      common_mistakes JSONB DEFAULT '[]',
      recent_topics JSONB DEFAULT '[]',
      upcoming_assessments JSONB DEFAULT '[]',
      best_study_methods JSONB DEFAULT '[]',
      evidence_trail JSONB DEFAULT '[]',
      risk_level TEXT NOT NULL DEFAULT 'low',
      predicted_next_task TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, subject_key)
    )
  `);
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS student_subject_memory_user_risk_idx ON student_subject_memory(user_id, risk_level)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS student_subject_memory_subject_idx ON student_subject_memory(subject_id)");
};

const ensurePublicContactSchema = async () => {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public_contact_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      year_level TEXT,
      school TEXT,
      subject TEXT,
      question TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'pending',
      delivery_error TEXT,
      admin_status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe("ALTER TABLE public_contact_submissions ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'new'");
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS public_contact_submissions_created_idx ON public_contact_submissions(created_at DESC)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS public_contact_submissions_email_idx ON public_contact_submissions(email)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS public_contact_submissions_admin_status_idx ON public_contact_submissions(admin_status)"
  );
};

const ensureSubjectLifecycleSchema = async () => {
  await prisma.$executeRawUnsafe("ALTER TABLE user_subjects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ");
  await prisma.$executeRawUnsafe("ALTER TABLE user_subjects ADD COLUMN IF NOT EXISTS archived_reason TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE user_subjects ADD COLUMN IF NOT EXISTS superseded_by_subject_id UUID");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS user_subjects_user_archived_idx ON user_subjects(user_id, archived_at)");
};

const ensureCommunityTrustSchema = async () => {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_question_saves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, question_id)
    )
  `);
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_question_saves_question_idx ON community_question_saves(question_id)");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_question_helpful_votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answer_message_id UUID NOT NULL REFERENCES community_chat_messages(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, answer_message_id)
    )
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS community_question_helpful_votes_answer_idx ON community_question_helpful_votes(answer_message_id)"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      message_id UUID REFERENCES community_chat_messages(id) ON DELETE SET NULL,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_reports_status_created_idx ON community_reports(status, created_at)");
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS community_reports_reported_user_created_idx ON community_reports(reported_user_id, created_at)"
  );
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_reports_message_idx ON community_reports(message_id)");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_user_mutes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      muted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, muted_user_id)
    )
  `);
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_user_mutes_muted_user_idx ON community_user_mutes(muted_user_id)");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_chess_tournament_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start DATE NOT NULL,
      minutes_at_entry INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'joined',
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, week_start)
    )
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS community_chess_tournament_entries_week_created_idx ON community_chess_tournament_entries(week_start, created_at)"
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS community_chess_matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      week_start DATE NOT NULL,
      round INTEGER NOT NULL,
      match_code TEXT NOT NULL UNIQUE,
      white_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      black_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fen TEXT NOT NULL,
      pgn TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      result TEXT,
      winner_user_id UUID REFERENCES users(id),
      last_move_from TEXT,
      last_move_to TEXT,
      last_move_san TEXT,
      last_move_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (week_start, round, white_user_id, black_user_id)
    )
  `);
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_chess_matches_white_status_idx ON community_chess_matches(white_user_id, status)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_chess_matches_black_status_idx ON community_chess_matches(black_user_id, status)");
  await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS community_chess_matches_week_round_idx ON community_chess_matches(week_start, round)");
};

export const ensureDatabaseSchema = async () => {
  await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_name TEXT`;
  await prisma.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_opt_in BOOLEAN NOT NULL DEFAULT TRUE");
  await prisma.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_unsubscribed_at TIMESTAMPTZ");
  await prisma.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_last_sent_at TIMESTAMPTZ");
  await prisma.$executeRawUnsafe("ALTER TABLE user_gamification ALTER COLUMN leaderboard_opt_in SET DEFAULT TRUE");
  await prisma.$executeRawUnsafe(`
    UPDATE user_gamification
    SET leaderboard_opt_in = TRUE, leaderboard_prompted_at = COALESCE(leaderboard_prompted_at, now())
    WHERE leaderboard_opt_in = FALSE
      AND leaderboard_prompted_at IS NULL
  `);
  await ensureSubjectLifecycleSchema();
  await ensureStudentMemorySchema();
  await ensurePublicContactSchema();
  await ensureCommunityTrustSchema();

  const usersMissingSchool = await prisma.user.findMany({
    where: {
      OR: [{ schoolName: null }, { schoolName: "" }]
    },
    select: {
      id: true,
      email: true
    }
  });

  const updates = usersMissingSchool
    .map((user) => ({
      id: user.id,
      schoolName: inferSchoolNameFromEmail(user.email)
    }))
    .filter((user): user is { id: string; schoolName: string } => Boolean(user.schoolName));

  if (updates.length) {
    await prisma.$transaction(
      updates.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: { schoolName: user.schoolName }
        })
      )
    );
    console.log(`Backfilled school names for ${updates.length} users.`);
  }
};
