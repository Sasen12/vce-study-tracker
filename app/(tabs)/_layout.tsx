import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ForgeMascot } from "@/components/navigation/ForgeMascot";
import { GuidedAppTour } from "@/components/navigation/GuidedAppTour";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useStudyReminders } from "@/hooks/useStudyReminders";
import { useAuthStore } from "@/store/authStore";

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const activePalette = useActivePalette();
  useStudyReminders();
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1 }}>
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
          name="insights"
          options={{
            title: "Insights",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="map-search-outline" color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="dots-grid" color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="questions"
          options={{
            href: null,
            title: "Questions",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cards-outline" color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            href: null,
            title: "Community",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="forum-outline" color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            href: null,
            title: "Shop",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shopping-outline" color={color} size={size} />
          }}
        />
        <Tabs.Screen
          name="pro"
          options={{
            href: null,
            title: "Pro"
          }}
        />
        <Tabs.Screen
          name="onboarding"
          options={{
            href: null,
            title: "Guide",
            tabBarStyle: { display: "none" }
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
            title: "Profile",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" color={color} size={size} />
          }}
        />
      </Tabs>
      <ForgeMascot />
      <GuidedAppTour />
    </View>
  );
}
