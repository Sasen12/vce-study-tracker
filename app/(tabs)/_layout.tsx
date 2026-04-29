import { Redirect, Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useStudyReminders } from "@/hooks/useStudyReminders";
import { useAuthStore } from "@/store/authStore";

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const activePalette = useActivePalette();
  useStudyReminders();
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: activePalette.surface,
          borderTopColor: activePalette.border,
          height: 74,
          paddingTop: 8,
          paddingBottom: 12
        },
        tabBarActiveTintColor: activePalette.primary,
        tabBarInactiveTintColor: activePalette.muted,
        tabBarLabelStyle: {
          fontFamily: "Outfit_700Bold",
          fontSize: 11
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: "Study",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="timer-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-month" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="questions"
        options={{
          title: "Questions",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cards-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
