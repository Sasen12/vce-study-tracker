import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { palette } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";
import { hasRecoverableActiveTimer } from "@/utils/activeStudyTimer";
import { useTimerActivity } from "@/utils/timerActivity";

type BuildInfo = {
  buildId: string;
  shortHash?: string;
  message?: string;
  changes?: string[];
  branch?: string | null;
  committedAt?: string | null;
  builtAt?: string;
};

const pollIntervalMs = 2 * 60 * 1000;

const fetchBuildInfo = async () => {
  const response = await fetch(`/build-info.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache"
    }
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Partial<BuildInfo>;
  if (typeof data.buildId !== "string" || !data.buildId) return null;
  return data as BuildInfo;
};

const formatBuildDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

export function BuildUpdateNotice() {
  const timerActivity = useTimerActivity();
  const userId = useAuthStore((state) => state.user?.id);
  const currentBuildId = useRef<string | null>(null);
  const [update, setUpdate] = useState<BuildInfo | null>(null);
  const [storedTimerActive, setStoredTimerActive] = useState(false);
  const [checkingStoredTimer, setCheckingStoredTimer] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;

    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const info = await fetchBuildInfo();
        if (cancelled || !info) return;

        if (!currentBuildId.current) {
          currentBuildId.current = info.buildId;
          return;
        }

        if (info.buildId !== currentBuildId.current) {
          setUpdate((current) => (current?.buildId === info.buildId ? current : info));
        }
      } catch {
        // Missing build metadata is expected in local dev.
      }
    };

    checkForUpdate();
    const interval = setInterval(checkForUpdate, pollIntervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !update || timerActivity.running) {
      setStoredTimerActive(false);
      setCheckingStoredTimer(false);
      return undefined;
    }

    let active = true;
    const checkStoredTimer = async () => {
      setCheckingStoredTimer(true);
      const hasTimer = await hasRecoverableActiveTimer(userId);
      if (active) {
        setStoredTimerActive(hasTimer);
        setCheckingStoredTimer(false);
      }
    };

    checkStoredTimer();
    const interval = setInterval(checkStoredTimer, 15_000);
    return () => {
      active = false;
      setCheckingStoredTimer(false);
      clearInterval(interval);
    };
  }, [timerActivity.running, update, userId]);

  const reload = () => {
    if (Platform.OS === "web") {
      window.location.reload();
    }
  };

  const dismiss = () => {
    if (update?.buildId) {
      currentBuildId.current = update.buildId;
    }
    setUpdate(null);
  };

  const changedAt = formatBuildDate(update?.committedAt ?? update?.builtAt);
  const changes = update?.changes?.length
    ? update.changes.slice(0, 5)
    : [update?.message ?? "Fresh fixes and improvements are ready."];
  const visible = Boolean(update) && !timerActivity.running && !storedTimerActive && !checkingStoredTimer;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={dismiss} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Update ready</Dialog.Title>
        <Dialog.Content style={styles.dialogContent}>
          <Text style={styles.body}>
            A new VCE Forge build is ready. Reload between tasks to pick up the latest fixes and features.
          </Text>
          <Text style={styles.label}>Latest changes</Text>
          {changes.map((change) => (
            <Text key={change} style={styles.changeText}>
              - {change}
            </Text>
          ))}
          <Text style={styles.meta}>
            {update?.shortHash ? `Build ${update.shortHash}` : "New build"}
            {changedAt ? ` - ${changedAt}` : ""}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={dismiss}>Later</Button>
          <Button mode="contained" icon="refresh" onPress={reload}>
            Reload app
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: palette.surface,
    borderRadius: 8
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dialogContent: {
    gap: 10
  },
  body: {
    color: palette.muted,
    lineHeight: 20
  },
  label: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  changeText: {
    color: palette.text,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  meta: {
    color: palette.muted,
    fontSize: 12
  }
});
