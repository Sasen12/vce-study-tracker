import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { palette } from "@/constants/theme";

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
  const currentBuildId = useRef<string | null>(null);
  const [update, setUpdate] = useState<BuildInfo | null>(null);

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
          setUpdate(info);
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

  const reload = () => {
    if (Platform.OS === "web") {
      window.location.reload();
    }
  };

  const changedAt = formatBuildDate(update?.committedAt ?? update?.builtAt);
  const changes = update?.changes?.length ? update.changes.slice(0, 5) : [update?.message ?? "New app update"];

  return (
    <Portal>
      <Dialog visible={Boolean(update)} onDismiss={() => setUpdate(null)} style={styles.dialog}>
        <Dialog.Title style={styles.dialogTitle}>Update available</Dialog.Title>
        <Dialog.Content style={styles.dialogContent}>
          <Text style={styles.body}>A newer VCE Forge build is live. Reload to use the latest version.</Text>
          <Text style={styles.label}>What changed</Text>
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
          <Button onPress={() => setUpdate(null)}>Later</Button>
          <Button mode="contained" icon="refresh" onPress={reload}>
            Reload
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
