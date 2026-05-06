import type { Gamification } from "@/types";

const APP_TIME_ZONE = "Australia/Melbourne";

const dateKeyInAppZone = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const getActiveStreak = (gamification?: Pick<Gamification, "currentStreak" | "lastStudyDate"> | null) => {
  if (!gamification?.currentStreak) return 0;

  const lastStudyDate = gamification.lastStudyDate?.slice(0, 10);
  if (!lastStudyDate) return 0;

  const today = dateKeyInAppZone();
  return lastStudyDate === today || addDays(lastStudyDate, 1) === today ? gamification.currentStreak : 0;
};
