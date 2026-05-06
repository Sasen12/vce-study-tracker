import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useAppStore } from "@/store/appStore";
import { expandEventOccurrences, isAssessmentEvent, isStudyTimeEvent, isTutorSessionEvent, localDateKey, addDays } from "@/utils/studyEvents";

const remindersKey = "vce_study_reminders_enabled";
const sentKey = "vce_study_reminders_sent";
const changedEventName = "vce-study-reminders-changed";

const browserNotificationsAvailable = () =>
  Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window;

const readEnabled = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return window.localStorage.getItem(remindersKey) === "true";
};

const readSent = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return new Set<string>();
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(sentKey) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
};

const writeSent = (sent: Set<string>) => {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.sessionStorage.setItem(sentKey, JSON.stringify([...sent].slice(-120)));
};

export const remindersSupported = browserNotificationsAvailable;

export const enableStudyReminders = async () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  if (browserNotificationsAvailable() && window.Notification.permission === "default") {
    await window.Notification.requestPermission();
  }
  window.localStorage.setItem(remindersKey, "true");
  window.dispatchEvent(new Event(changedEventName));
  return true;
};

export const remindersAreEnabled = readEnabled;

export function useStudyReminders() {
  const events = useAppStore((state) => state.events);
  const [enabled, setEnabled] = useState(readEnabled);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
    const sync = () => setEnabled(readEnabled());
    window.addEventListener("storage", sync);
    window.addEventListener(changedEventName, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(changedEventName, sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const check = () => {
      const now = new Date();
      const startKey = localDateKey(now);
      const endKey = localDateKey(addDays(now, 2));
      const sent = readSent();
      const upcoming = expandEventOccurrences(
        events.filter((event) => !event.completed && (isAssessmentEvent(event) || isStudyTimeEvent(event))),
        startKey,
        endKey
      );

      for (const occurrence of upcoming) {
        const minutesUntil = Math.round((occurrence.startAt.getTime() - now.getTime()) / 60_000);
        const leadMinutes = occurrence.event.notificationMinutes ?? (isStudyTimeEvent(occurrence.event) ? 15 : 60);
        if (minutesUntil < 0 || minutesUntil > leadMinutes) continue;

        const notificationId = `${occurrence.id}-${leadMinutes}`;
        if (sent.has(notificationId)) continue;
        sent.add(notificationId);

        const title = isTutorSessionEvent(occurrence.event)
          ? "Tutor session soon"
          : isStudyTimeEvent(occurrence.event)
            ? "Study time soon"
            : `${occurrence.event.eventType} reminder`;
        const body = isStudyTimeEvent(occurrence.event)
          ? `${occurrence.event.title} starts at ${occurrence.event.startTime}.`
          : `${occurrence.event.title} is ${minutesUntil <= 0 ? "now" : `in ${minutesUntil} min`}.`;

        if (browserNotificationsAvailable() && window.Notification.permission === "granted") {
          new window.Notification(title, { body });
        }
      }
      writeSent(sent);
    };

    check();
    const interval = window.setInterval(check, 60_000);
    return () => window.clearInterval(interval);
  }, [enabled, events]);
}
