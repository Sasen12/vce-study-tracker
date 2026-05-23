import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { defaultTabRouteFor, loadDefaultTab, type DefaultTabRoute } from "@/utils/defaultTab";

export function DefaultTabRedirect() {
  const userId = useAuthStore((state) => state.user?.id);
  const [route, setRoute] = useState<DefaultTabRoute | null>(null);

  useEffect(() => {
    let active = true;
    setRoute(null);
    loadDefaultTab(userId).then((tab) => {
      if (active) setRoute(defaultTabRouteFor(tab));
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!route) return null;
  return <Redirect href={route} />;
}
