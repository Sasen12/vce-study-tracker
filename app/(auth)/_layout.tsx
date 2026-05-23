import { Stack } from "expo-router";
import { DefaultTabRedirect } from "@/components/navigation/DefaultTabRedirect";
import { useAuthStore } from "@/store/authStore";

export default function AuthLayout() {
  const user = useAuthStore((state) => state.user);
  if (user) return <DefaultTabRedirect />;
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
