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

export const BADGES = [
  { id: "first_session", label: "First Session", trigger: "Complete first study session" },
  { id: "early_bird", label: "Early Bird", trigger: "Study before 8am" },
  { id: "night_owl", label: "Night Owl", trigger: "Study after 10pm" },
  { id: "marathon", label: "Marathon", trigger: "Single session over 2 hours" },
  { id: "week_warrior", label: "Week Warrior", trigger: "7-day streak" },
  { id: "month_grinder", label: "Month Grinder", trigger: "30-day streak" },
  { id: "subject_master", label: "Subject Master", trigger: "50+ hours in one subject" },
  { id: "question_king", label: "Question King", trigger: "Generate 100 questions" },
  { id: "goal_setter", label: "Goal Setter", trigger: "Set goals for all subjects" },
  { id: "sac_ready", label: "SAC Ready", trigger: "Add upcoming SAC dates" },
  { id: "all_rounder", label: "All Rounder", trigger: "Study 4+ subjects" },
  { id: "badge_first_focus", label: "First Focus", trigger: "Coin shop collectible" },
  { id: "badge_calm_under_pressure", label: "Calm Under Pressure", trigger: "Coin shop collectible" },
  { id: "badge_deadline_defender", label: "Deadline Defender", trigger: "Coin shop collectible" },
  { id: "badge_past_paper_pro", label: "Past Paper Pro", trigger: "Coin shop collectible" },
  { id: "badge_focus_keeper", label: "Focus Keeper", trigger: "Coin shop collectible" },
  { id: "badge_comeback_energy", label: "Comeback Energy", trigger: "Coin shop collectible" },
  { id: "founding_student", label: "Founding Student", trigger: "Early community member" },
  { id: "original_17", label: "Original 17", trigger: "First wave of VCE Forge students" },
  { id: "weekly_lock_in", label: "Weekly Lock-In", trigger: "Complete the weekly community mission" }
];

export const DEFAULT_TITLE_ID = "vce_rookie";
export const STARTER_TITLE_IDS = [DEFAULT_TITLE_ID, "year_11_rookie", "year_12_rookie"] as const;

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
  },
  {
    id: "founding_student",
    label: "Founding Student",
    price: 0,
    description: "Early status for the students who helped shape VCE Forge."
  },
  {
    id: "original_17",
    label: "Original 17",
    price: 0,
    description: "For the first wave of students who made the community real."
  },
  {
    id: "atar_goblin",
    label: "ATAR Goblin",
    price: 220,
    description: "For dangerous amounts of revision energy."
  },
  {
    id: "essay_demon",
    label: "Essay Demon",
    price: 260,
    description: "For students who keep showing up to the blank page."
  },
  {
    id: "methods_menace",
    label: "Methods Menace",
    price: 300,
    description: "For Methods grinders who refuse to leave marks behind."
  },
  {
    id: "business_weapon",
    label: "Business Weapon",
    price: 300,
    description: "For sharp command-term and case-study work."
  },
  {
    id: "data_wizard",
    label: "Data Wizard",
    price: 300,
    description: "For students turning messy data into clean answers."
  }
];

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
];

export const PERK_SHOP_ITEMS = [
  {
    id: "rescue_plus",
    label: "Rescue Plus",
    price: 120,
    icon: "lifebuoy",
    description: "Unlock 8, 12 and 18 minute rescue presets on Home."
  },
  {
    id: "focus_aura",
    label: "Focus Aura",
    price: 180,
    icon: "radar",
    description: "Give the study timer a subtle unlocked focus-state glow."
  },
  {
    id: "streak_shield",
    label: "Streak Shield",
    price: 240,
    icon: "shield-check-outline",
    description: "Adds a quiet 8 minute save-the-streak launcher when today is empty."
  },
  {
    id: "victory_vault",
    label: "Victory Vault",
    price: 300,
    icon: "archive-star-outline",
    description: "Unlocks a recent wins vault from your logged study evidence."
  },
  {
    id: "boss_battle",
    label: "Boss Battle Deck",
    price: 420,
    icon: "sword-cross",
    description: "Jump straight into a hard battle drill from Home."
  }
];

export const perkCosmeticId = (perkId: string) => `perk:${perkId}`;

export const hasUnlockedPerk = (unlockedCosmetics: string[] | undefined | null, perkId: string) =>
  Boolean(unlockedCosmetics?.includes(perkCosmeticId(perkId)));

export const titleLabelById = (titleId?: string | null) =>
  TITLE_SHOP_ITEMS.find((title) => title.id === titleId)?.label ??
  TITLE_SHOP_ITEMS.find((title) => title.id === DEFAULT_TITLE_ID)?.label ??
  TITLE_SHOP_ITEMS[0].label;

export const MOTIVATION_MESSAGES = [
  "SAC szn let's go",
  "38+ incoming",
  "Past paper energy unlocked",
  "Your future self is nodding",
  "Another brick in the ATAR wall",
  "That one counts on results day",
  "VCAA will hear about this",
  "Clean study minutes. Love to see it",
  "Momentum is doing the quiet work",
  "One session closer to the score",
  "Academic comeback loading",
  "The grind has receipts",
  "Study score aura increased",
  "Unit 3/4 mode: active",
  "You beat the blank page",
  "That SAC just got less scary",
  "Consistency is the cheat code",
  "Rankings beware",
  "Elite revision behaviour",
  "Small session, big compound interest",
  "Exam season you will be grateful",
  "Keep stacking the evidence"
];
