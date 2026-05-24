import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { defaultTabRouteFor, loadDefaultTab, type DefaultTabRoute } from "@/utils/defaultTab";
import { hasSeenAppGuide } from "@/utils/appGuide";

export function DefaultTabRedirect() {
  const userId = useAuthStore((state) => state.user?.id);
  const [route, setRoute] = useState<DefaultTabRoute | "/(tabs)/onboarding" | null>(null);

  useEffect(() => {
    let active = true;
    setRoute(null);
    Promise.all([loadDefaultTab(userId), hasSeenAppGuide(userId)])
      .then(([tab, guideSeen]) => {
        if (active) setRoute(guideSeen ? defaultTabRouteFor(tab) : "/(tabs)/onboarding");
      })
      .catch(() => {
        if (active) setRoute("/(tabs)/onboarding");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!route) return null;
  return <Redirect href={route} />;
}
