import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function IndexRoute() {
  const user = useAuthStore((state) => state.user);
  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}

