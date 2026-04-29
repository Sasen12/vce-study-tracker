import type { EventRecurrence, EventType, StudyEvent } from "@/types";

export type EventOccurrence = {
  id: string;
  event: StudyEvent;
  dateKey: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
};

export const assessmentEventTypes: EventType[] = ["SAC", "SAT", "PRACTICE_SAC", "PRACTICE_SAT", "EXAM", "TASK"];

export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const todayKey = () => localDateKey(new Date());

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const eventDateKey = (event: StudyEvent) => event.eventDate.slice(0, 10);

export const isStudyTimeEvent = (event: Pick<StudyEvent, "eventType">) => event.eventType === "STUDY_TIME";
export const isAssessmentEvent = (event: Pick<StudyEvent, "eventType">) =>
  assessmentEventTypes.includes(event.eventType);

const parseLocalDate = (dateKey: string) => new Date(`${dateKey}T00:00:00`);

export const daysBetweenKeys = (fromKey: string, toKey: string) => {
  const from = parseLocalDate(fromKey);
  const to = parseLocalDate(toKey);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
};

export const recurrenceLabel = (recurrence?: EventRecurrence | null) => {
  if (recurrence === "WEEKLY") return "weekly";
  if (recurrence === "FORTNIGHTLY_WEEK_1") return "week 1";
  if (recurrence === "FORTNIGHTLY_WEEK_2") return "week 2";
  return "once";
};

const occursOnDate = (event: StudyEvent, dateKey: string) => {
  const firstDate = eventDateKey(event);
  if (dateKey < firstDate) return false;
  if (event.recurrenceUntil && dateKey > event.recurrenceUntil.slice(0, 10)) return false;

  const diff = daysBetweenKeys(firstDate, dateKey);
  if (event.recurrence === "WEEKLY") return diff % 7 === 0;
  if (event.recurrence === "FORTNIGHTLY_WEEK_1" || event.recurrence === "FORTNIGHTLY_WEEK_2") {
    return diff % 14 === 0;
  }
  return diff === 0;
};

const dateTimeFor = (dateKey: string, time?: string | null, fallback = "08:00") =>
  new Date(`${dateKey}T${time || fallback}:00`);

const durationMinutes = (event: StudyEvent) => {
  if (!event.startTime || !event.endTime) return 0;
  const start = dateTimeFor(eventDateKey(event), event.startTime);
  const end = dateTimeFor(eventDateKey(event), event.endTime);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
};

export const expandEventOccurrences = (events: StudyEvent[], startKey: string, endKey: string) => {
  const occurrences: EventOccurrence[] = [];
  const start = parseLocalDate(startKey);
  const end = parseLocalDate(endKey);

  for (let date = start; date <= end; date = addDays(date, 1)) {
    const key = localDateKey(date);
    for (const event of events) {
      if (!occursOnDate(event, key)) continue;
      const startAt = dateTimeFor(key, event.startTime, isStudyTimeEvent(event) ? "00:00" : "08:00");
      const minutes = durationMinutes(event);
      const endAt = minutes ? new Date(startAt.getTime() + minutes * 60_000) : startAt;
      occurrences.push({
        id: `${event.id}-${key}`,
        event,
        dateKey: key,
        startAt,
        endAt,
        durationMinutes: minutes
      });
    }
  }

  return occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
};
