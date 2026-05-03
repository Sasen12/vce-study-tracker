import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { studyApi } from "@/services/studyApi";
import type { UsageScreen } from "@/types";

export const useTrackScreen = (screen: UsageScreen) => {
  useFocusEffect(
    useCallback(() => {
      studyApi.trackUsage(screen).catch(() => undefined);
    }, [screen])
  );
};
