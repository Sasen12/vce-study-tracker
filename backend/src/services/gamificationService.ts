import { prisma } from "../db/prismaClient.js";
import { dateKeyInMelbourne, hourInMelbourne, isYesterday, toDateOnly, todayMelbourne } from "../utils/date.js";

export const LEVELS = [
  { level: 1, xp: 0, title: "Year 12 Rookie" },
  { level: 2, xp: 200, title: "On the Grind" },
  { level: 3, xp: 500, title: "SAC Survivor" },
  { level: 4, xp: 1000, title: "Study Machine" },
  { level: 5, xp: 2000, title: "ATAR Hunter" },
  { level: 6, xp: 3500, title: "VCE Veteran" },
  { level: 7, xp: 5500, title: "Rank God" },
  { level: 8, xp: 8000, title: "50 Study Score" }
];

export const calculateSessionXp = (durationSeconds: number) => {
  const base = Math.floor(durationSeconds / 600) * 10;
  const bonus = durationSeconds > 3600 ? 25 : 0;
  return base + bonus;
};

export const levelFromXp = (xp: number) =>
  LEVELS.reduce((best, level) => (xp >= level.xp ? level.level : best), 1);

const badgesAsArray = (badges: unknown): string[] =>
  Array.isArray(badges) ? badges.filter((badge): badge is string => typeof badge === "string") : [];

const mergeBadges = (current: unknown, incoming: string[]) =>
  Array.from(new Set([...badgesAsArray(current), ...incoming]));

export const ensureGamification = async (userId: string) =>
  prisma.userGamification.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });

export const addXp = async (userId: string, xp: number) => {
  const current = await ensureGamification(userId);
  const totalXp = current.totalXp + xp;
  return prisma.userGamification.update({
    where: { userId },
    data: {
      totalXp,
      level: levelFromXp(totalXp)
    }
  });
};

export const recordStudySessionEffects = async (input: {
  userId: string;
  subjectId?: string | null;
  durationSeconds: number;
  xpEarned: number;
  createdAt: Date;
}) => {
  const gamification = await ensureGamification(input.userId);
  const today = dateKeyInMelbourne(input.createdAt);
  const lastStudyDate = gamification.lastStudyDate?.toISOString().slice(0, 10);
  const alreadyStudiedToday = lastStudyDate === today;
  const nextStreak = alreadyStudiedToday
    ? gamification.currentStreak
    : isYesterday(lastStudyDate, today)
      ? gamification.currentStreak + 1
      : 1;
  const totalXp = gamification.totalXp + input.xpEarned;

  const [sessionCount, subjectTotal, distinctSubjects] = await Promise.all([
    prisma.studySession.count({ where: { userId: input.userId } }),
    input.subjectId
      ? prisma.studySession.aggregate({
          where: { userId: input.userId, subjectId: input.subjectId },
          _sum: { durationSeconds: true }
        })
      : Promise.resolve({ _sum: { durationSeconds: 0 } }),
    prisma.studySession.groupBy({
      by: ["subjectId"],
      where: { userId: input.userId, subjectId: { not: null } }
    })
  ]);

  const hour = hourInMelbourne(input.createdAt);
  const earnedBadges = [
    sessionCount === 1 ? "first_session" : null,
    hour < 8 ? "early_bird" : null,
    hour >= 22 ? "night_owl" : null,
    input.durationSeconds > 7200 ? "marathon" : null,
    nextStreak >= 7 ? "week_warrior" : null,
    nextStreak >= 30 ? "month_grinder" : null,
    (subjectTotal._sum.durationSeconds ?? 0) >= 50 * 3600 ? "subject_master" : null,
    distinctSubjects.length >= 4 ? "all_rounder" : null
  ].filter((badge): badge is string => Boolean(badge));

  return prisma.userGamification.update({
    where: { userId: input.userId },
    data: {
      totalXp,
      level: levelFromXp(totalXp),
      currentStreak: nextStreak,
      longestStreak: Math.max(gamification.longestStreak, nextStreak),
      lastStudyDate: toDateOnly(today),
      badges: mergeBadges(gamification.badges, earnedBadges)
    }
  });
};

export const awardGoalBadges = async (userId: string) => {
  const [subjectsCount, goalsCount, gamification] = await Promise.all([
    prisma.userSubject.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
    ensureGamification(userId)
  ]);

  if (subjectsCount > 0 && goalsCount >= subjectsCount) {
    return prisma.userGamification.update({
      where: { userId },
      data: { badges: mergeBadges(gamification.badges, ["goal_setter"]) }
    });
  }

  return gamification;
};

export const awardEventBadges = async (userId: string) => {
  const [subjectsCount, sacSubjectCount, gamification] = await Promise.all([
    prisma.userSubject.count({ where: { userId } }),
    prisma.event.groupBy({
      by: ["subjectId"],
      where: {
        userId,
        eventType: { in: ["SAC", "SAT"] },
        completed: false,
        eventDate: { gte: toDateOnly(todayMelbourne()) },
        subjectId: { not: null }
      }
    }),
    ensureGamification(userId)
  ]);

  if (subjectsCount > 0 && sacSubjectCount.length >= subjectsCount) {
    return prisma.userGamification.update({
      where: { userId },
      data: { badges: mergeBadges(gamification.badges, ["sac_ready"]) }
    });
  }

  return gamification;
};

export const awardQuestionBadges = async (userId: string) => {
  const [savedCount, gamification] = await Promise.all([
    prisma.savedQuestion.count({ where: { userId } }),
    ensureGamification(userId)
  ]);

  if (savedCount >= 100) {
    return prisma.userGamification.update({
      where: { userId },
      data: { badges: mergeBadges(gamification.badges, ["question_king"]) }
    });
  }

  return gamification;
};

export const syncAllBadges = async (userId: string) => {
  await awardGoalBadges(userId);
  await awardEventBadges(userId);
  await awardQuestionBadges(userId);
  return ensureGamification(userId);
};

export const resetExpiredStreaks = async () => {
  const today = toDateOnly(todayMelbourne());
  return prisma.userGamification.updateMany({
    where: {
      currentStreak: { gt: 0 },
      OR: [{ lastStudyDate: null }, { lastStudyDate: { lt: today } }]
    },
    data: { currentStreak: 0 }
  });
};
