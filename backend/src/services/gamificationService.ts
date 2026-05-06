import { prisma } from "../db/prismaClient.js";
import { dateKeyInMelbourne, hourInMelbourne, isYesterday, toDateOnly, todayMelbourne } from "../utils/date.js";

export const LEVELS = [
  { level: 1, xp: 0, title: "VCE Rookie" },
  { level: 2, xp: 200, title: "On the Grind" },
  { level: 3, xp: 500, title: "SAC Survivor" },
  { level: 4, xp: 1000, title: "Study Machine" },
  { level: 5, xp: 2000, title: "ATAR Hunter" },
  { level: 6, xp: 3500, title: "VCE Veteran" },
  { level: 7, xp: 5500, title: "Rank God" },
  { level: 8, xp: 8000, title: "50 Study Score" }
];

export const DEFAULT_THEME_ID = "midnight";
export const DEFAULT_TITLE_ID = "vce_rookie";
export const STARTER_TITLE_IDS = [DEFAULT_TITLE_ID, "year_11_rookie", "year_12_rookie"] as const;

export const THEME_SHOP_ITEMS = [
  {
    id: "midnight",
    name: "Midnight Focus",
    price: 0,
    colors: { primary: "#7C6EFF", secondary: "#FF6B6B", background: "#0F0F14", surface: "#1A1A24" }
  },
  {
    id: "mint",
    name: "Mint Sprint",
    price: 60,
    colors: { primary: "#34D399", secondary: "#60A5FA", background: "#071412", surface: "#10211D" }
  },
  {
    id: "sunset",
    name: "Sunset Revision",
    price: 90,
    colors: { primary: "#FB7185", secondary: "#F59E0B", background: "#180D12", surface: "#261820" }
  },
  {
    id: "ocean",
    name: "Ocean Mode",
    price: 140,
    colors: { primary: "#38BDF8", secondary: "#2DD4BF", background: "#06111F", surface: "#0F1D2D" }
  },
  {
    id: "royal",
    name: "Royal Grind",
    price: 320,
    colors: { primary: "#A78BFA", secondary: "#F472B6", background: "#120B22", surface: "#1F1633" }
  },
  {
    id: "aurora",
    name: "Aurora Shift",
    price: 360,
    colors: { primary: "#2DD4BF", secondary: "#F472B6", background: "#07110F", surface: "#10201D" }
  },
  {
    id: "citrus",
    name: "Citrus Lab",
    price: 420,
    colors: { primary: "#A3E635", secondary: "#F97316", background: "#10130A", surface: "#1D2212" }
  },
  {
    id: "cherry",
    name: "Cherry Desk",
    price: 460,
    colors: { primary: "#F43F5E", secondary: "#22D3EE", background: "#17090D", surface: "#261018" }
  },
  {
    id: "glacier",
    name: "Glacier Notes",
    price: 520,
    colors: { primary: "#67E8F9", secondary: "#C084FC", background: "#071218", surface: "#10212A" }
  },
  {
    id: "graphite",
    name: "Graphite Focus",
    price: 560,
    colors: { primary: "#D1D5DB", secondary: "#F97316", background: "#111315", surface: "#1D2224" }
  },
  {
    id: "arcade",
    name: "Arcade Sprint",
    price: 620,
    colors: { primary: "#22D3EE", secondary: "#FB7185", background: "#0E0A18", surface: "#1B1230" }
  },
  {
    id: "forest",
    name: "Forest Method",
    price: 680,
    colors: { primary: "#4ADE80", secondary: "#FBBF24", background: "#07120D", surface: "#102218" }
  },
  {
    id: "rose_gold",
    name: "Rose Gold",
    price: 740,
    colors: { primary: "#FDA4AF", secondary: "#F59E0B", background: "#160D11", surface: "#24161B" }
  },
  {
    id: "matrix",
    name: "Matrix Mode",
    price: 820,
    colors: { primary: "#22C55E", secondary: "#38BDF8", background: "#050A07", surface: "#0D1711" }
  },
  {
    id: "cherry_blossom",
    name: "Cherry Blossom",
    price: 880,
    motion: "blossom",
    colors: { primary: "#F9A8D4", secondary: "#A7F3D0", background: "#160D15", surface: "#251822" }
  },
  {
    id: "spring_picnic",
    name: "Spring Picnic",
    price: 940,
    motion: "spring",
    colors: { primary: "#86EFAC", secondary: "#F9A8D4", background: "#08130F", surface: "#13221A" }
  },
  {
    id: "summer_glow",
    name: "Summer Glow",
    price: 1000,
    motion: "glow",
    colors: { primary: "#38BDF8", secondary: "#FBBF24", background: "#081018", surface: "#132231" }
  },
  {
    id: "easter_pastel",
    name: "Easter Pastel",
    price: 1060,
    motion: "pastel",
    colors: { primary: "#C4B5FD", secondary: "#F9A8D4", background: "#111022", surface: "#1D1A33" }
  },
  {
    id: "christmas_lights",
    name: "Christmas Lights",
    price: 1120,
    motion: "lights",
    colors: { primary: "#EF4444", secondary: "#FACC15", background: "#07110C", surface: "#121F17" }
  },
  {
    id: "snow_day",
    name: "Snow Day",
    price: 1180,
    motion: "snow",
    colors: { primary: "#BAE6FD", secondary: "#C4B5FD", background: "#071118", surface: "#10202A" }
  },
  {
    id: "pink_cloud",
    name: "Pink Cloud",
    price: 1240,
    motion: "blossom",
    colors: { primary: "#F0ABFC", secondary: "#FDA4AF", background: "#150F1A", surface: "#241929" }
  }
] as const;

export const TITLE_SHOP_ITEMS = [
  {
    id: DEFAULT_TITLE_ID,
    label: "VCE Rookie",
    price: 0,
    description: "Starter title for any VCE student."
  },
  {
    id: "year_11_rookie",
    label: "Year 11 Rookie",
    price: 0,
    description: "Starter title for Unit 1/2 students."
  },
  {
    id: "year_12_rookie",
    label: "Year 12 Rookie",
    price: 0,
    description: "Starter title for Unit 3/4 students."
  },
  {
    id: "academic_comeback",
    label: "Academic Comeback",
    price: 90,
    description: "For rebuilding momentum one block at a time."
  },
  {
    id: "revision_starter",
    label: "Revision Starter",
    price: 140,
    description: "For getting moving before the pressure arrives."
  },
  {
    id: "deadline_defender",
    label: "Deadline Defender",
    price: 360,
    description: "For students who live by the calendar."
  },
  {
    id: "past_paper_pro",
    label: "Past Paper Pro",
    price: 460,
    description: "For exam-style practice enjoyers."
  },
  {
    id: "focus_keeper",
    label: "Focus Keeper",
    price: 560,
    description: "A quiet flex for consistent study."
  },
  {
    id: "sac_ready",
    label: "SAC Ready",
    price: 640,
    description: "For going into assessment week prepared."
  }
] as const;

export const BADGE_SHOP_ITEMS = [
  {
    id: "badge_first_focus",
    label: "First Focus",
    price: 60,
    description: "A first collectible for getting a few focused blocks done."
  },
  {
    id: "badge_calm_under_pressure",
    label: "Calm Under Pressure",
    price: 140,
    description: "A collectible badge for steady exam-week energy."
  },
  {
    id: "badge_deadline_defender",
    label: "Deadline Defender",
    price: 300,
    description: "A collectible badge for calendar protectors."
  },
  {
    id: "badge_past_paper_pro",
    label: "Past Paper Pro",
    price: 380,
    description: "A collectible badge for practice exam grinders."
  },
  {
    id: "badge_focus_keeper",
    label: "Focus Keeper",
    price: 460,
    description: "A collectible badge for deep-work sessions."
  },
  {
    id: "badge_comeback_energy",
    label: "Comeback Energy",
    price: 540,
    description: "A collectible badge for turning the term around."
  }
] as const;

export type ThemeShopItem = (typeof THEME_SHOP_ITEMS)[number];

export const calculateSessionXp = (durationSeconds: number) => {
  const base = Math.floor(durationSeconds / 600) * 10;
  const bonus = durationSeconds > 3600 ? 25 : 0;
  return base + bonus;
};

export const levelFromXp = (xp: number) =>
  LEVELS.reduce((best, level) => (xp >= level.xp ? level.level : best), 1);

const badgesAsArray = (badges: unknown): string[] =>
  Array.isArray(badges) ? badges.filter((badge): badge is string => typeof badge === "string") : [];

const cosmeticsAsArray = (cosmetics: unknown): string[] =>
  Array.isArray(cosmetics) ? cosmetics.filter((cosmetic): cosmetic is string => typeof cosmetic === "string") : [];

const mergeBadges = (current: unknown, incoming: string[]) =>
  Array.from(new Set([...badgesAsArray(current), ...incoming]));

const mergeCosmetics = (current: unknown, incoming: string[]) =>
  Array.from(
    new Set([
      DEFAULT_THEME_ID,
      ...STARTER_TITLE_IDS.map((titleId) => `title:${titleId}`),
      ...cosmeticsAsArray(current),
      ...incoming
    ])
  );

export const ensureGamification = async (userId: string) => {
  const gamification = await prisma.userGamification.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      unlockedCosmetics: mergeCosmetics([], []),
      activeTheme: DEFAULT_THEME_ID,
      activeTitle: DEFAULT_TITLE_ID
    }
  });

  const unlocked = cosmeticsAsArray(gamification.unlockedCosmetics);
  const nextUnlocked = mergeCosmetics(gamification.unlockedCosmetics, []);
  const missingStarterTitles = nextUnlocked.some((cosmetic) => !unlocked.includes(cosmetic));
  const hasOnlyStarterTheme = unlocked.length <= 1 && (!unlocked.length || unlocked.includes(DEFAULT_THEME_ID));
  const shouldBackfillBalance = gamification.totalXp > 0 && gamification.xpBalance === 0 && hasOnlyStarterTheme;
  const lastStudyDate = gamification.lastStudyDate?.toISOString().slice(0, 10);
  const today = todayMelbourne();
  const streakExpired =
    gamification.currentStreak > 0 && (!lastStudyDate || (lastStudyDate !== today && !isYesterday(lastStudyDate, today)));

  if (missingStarterTitles || shouldBackfillBalance || streakExpired) {
    return prisma.userGamification.update({
      where: { userId },
      data: {
        ...(shouldBackfillBalance ? { xpBalance: gamification.totalXp } : {}),
        ...(missingStarterTitles ? { unlockedCosmetics: nextUnlocked } : {}),
        ...(streakExpired ? { currentStreak: 0 } : {})
      }
    });
  }

  return gamification;
};

export const addXp = async (userId: string, xp: number) => {
  const current = await ensureGamification(userId);
  const totalXp = current.totalXp + xp;
  return prisma.userGamification.update({
    where: { userId },
    data: {
      totalXp,
      xpBalance: { increment: xp },
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
      xpBalance: { increment: input.xpEarned },
      level: levelFromXp(totalXp),
      currentStreak: nextStreak,
      longestStreak: Math.max(gamification.longestStreak, nextStreak),
      lastStudyDate: toDateOnly(today),
      badges: mergeBadges(gamification.badges, earnedBadges)
    }
  });
};

const themeById = (themeId: string) => THEME_SHOP_ITEMS.find((item) => item.id === themeId);
const titleById = (titleId: string) => TITLE_SHOP_ITEMS.find((item) => item.id === titleId);
const badgeById = (badgeId: string) => BADGE_SHOP_ITEMS.find((item) => item.id === badgeId);
const titleCosmeticId = (titleId: string) => `title:${titleId}`;

export const unlockTheme = async (userId: string, themeId: string) => {
  const theme = themeById(themeId);
  if (!theme) throw new Error("Theme not found");

  const gamification = await ensureGamification(userId);
  const unlocked = mergeCosmetics(gamification.unlockedCosmetics, []);
  if (unlocked.includes(theme.id)) {
    return prisma.userGamification.update({
      where: { userId },
      data: { activeTheme: theme.id, unlockedCosmetics: unlocked }
    });
  }

  if (gamification.xpBalance < theme.price) {
    throw new Error("Not enough XP coins");
  }

  return prisma.userGamification.update({
    where: { userId },
    data: {
      xpBalance: { decrement: theme.price },
      unlockedCosmetics: mergeCosmetics(gamification.unlockedCosmetics, [theme.id]),
      activeTheme: theme.id
    }
  });
};

export const applyTheme = async (userId: string, themeId: string) => {
  const theme = themeById(themeId);
  if (!theme) throw new Error("Theme not found");

  const gamification = await ensureGamification(userId);
  const unlocked = mergeCosmetics(gamification.unlockedCosmetics, []);
  if (!unlocked.includes(theme.id)) {
    throw new Error("Unlock this theme first");
  }

  return prisma.userGamification.update({
    where: { userId },
    data: {
      unlockedCosmetics: unlocked,
      activeTheme: theme.id
    }
  });
};

export const grantThemeToUser = async (userId: string, themeId: string, equip = true) => {
  const theme = themeById(themeId);
  if (!theme) throw new Error("Theme not found");

  const gamification = await ensureGamification(userId);
  const unlockedCosmetics = mergeCosmetics(gamification.unlockedCosmetics, [theme.id]);

  return prisma.userGamification.update({
    where: { userId },
    data: {
      unlockedCosmetics,
      activeTheme: equip ? theme.id : gamification.activeTheme
    }
  });
};

export const unlockTitle = async (userId: string, titleId: string) => {
  const title = titleById(titleId);
  if (!title) throw new Error("Title not found");

  const gamification = await ensureGamification(userId);
  const unlocked = mergeCosmetics(gamification.unlockedCosmetics, [titleCosmeticId(DEFAULT_TITLE_ID)]);
  const cosmeticId = titleCosmeticId(title.id);

  if (unlocked.includes(cosmeticId)) {
    return prisma.userGamification.update({
      where: { userId },
      data: { activeTitle: title.id, unlockedCosmetics: unlocked }
    });
  }

  if (gamification.xpBalance < title.price) {
    throw new Error("Not enough XP coins");
  }

  return prisma.userGamification.update({
    where: { userId },
    data: {
      xpBalance: { decrement: title.price },
      unlockedCosmetics: mergeCosmetics(gamification.unlockedCosmetics, [titleCosmeticId(DEFAULT_TITLE_ID), cosmeticId]),
      activeTitle: title.id
    }
  });
};

export const applyTitle = async (userId: string, titleId: string) => {
  const title = titleById(titleId);
  if (!title) throw new Error("Title not found");

  const gamification = await ensureGamification(userId);
  const unlocked = mergeCosmetics(gamification.unlockedCosmetics, [titleCosmeticId(DEFAULT_TITLE_ID)]);
  const cosmeticId = titleCosmeticId(title.id);
  if (!unlocked.includes(cosmeticId)) {
    throw new Error("Unlock this title first");
  }

  return prisma.userGamification.update({
    where: { userId },
    data: {
      unlockedCosmetics: unlocked,
      activeTitle: title.id
    }
  });
};

export const unlockBadge = async (userId: string, badgeId: string) => {
  const badge = badgeById(badgeId);
  if (!badge) throw new Error("Badge not found");

  const gamification = await ensureGamification(userId);
  const badges = mergeBadges(gamification.badges, []);
  if (badges.includes(badge.id)) {
    return gamification;
  }

  if (gamification.xpBalance < badge.price) {
    throw new Error("Not enough XP coins");
  }

  return prisma.userGamification.update({
    where: { userId },
    data: {
      xpBalance: { decrement: badge.price },
      badges: mergeBadges(gamification.badges, [badge.id])
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
