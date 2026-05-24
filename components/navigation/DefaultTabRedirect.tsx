import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { initialAppRouteFor, type InitialAppRoute } from "@/utils/appGuide";

export function DefaultTabRedirect() {
  const userId = useAuthStore((state) => state.user?.id);
  const [route, setRoute] = useState<InitialAppRoute | null>(null);

  useEffect(() => {
    let active = true;
    setRoute(null);
    initialAppRouteFor(userId)
      .then((nextRoute) => {
        if (active) setRoute(nextRoute);
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
