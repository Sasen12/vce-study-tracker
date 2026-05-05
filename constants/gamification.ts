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
  { id: "badge_comeback_energy", label: "Comeback Energy", trigger: "Coin shop collectible" }
];

export const TITLE_SHOP_ITEMS = [
  {
    id: "year_12_rookie",
    label: "Year 12 Rookie",
    price: 0,
    description: "Starter profile title."
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

export const titleLabelById = (titleId?: string | null) =>
  TITLE_SHOP_ITEMS.find((title) => title.id === titleId)?.label ?? TITLE_SHOP_ITEMS[0].label;

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
