import { useSyncExternalStore } from "react";

type TimerActivitySnapshot = {
  running: boolean;
  updatedAt: number;
};

let snapshot: TimerActivitySnapshot = {
  running: false,
  updatedAt: Date.now()
};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const setTimerActivity = (next: Partial<Omit<TimerActivitySnapshot, "updatedAt">>) => {
  snapshot = {
    ...snapshot,
    ...next,
    updatedAt: Date.now()
  };
  notify();
};

export const useTimerActivity = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot
  );
