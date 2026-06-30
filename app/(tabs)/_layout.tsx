import { Redirect, Tabs } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ForgeMascot } from "@/components/navigation/ForgeMascot";
import { GuidedAppTour } from "@/components/navigation/GuidedAppTour";
import { SideNav } from "@/components/navigation/SideNav";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useStudyReminders } from "@/hooks/useStudyReminders";
import { useAuthStore } from "@/store/authStore";

const SIDEBAR_BREAKPOINT = 900;

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const activePalette = useActivePalette();
  const { width } = useWindowDimensions();
  const wideLayout = width >= SIDEBAR_BREAKPOINT;
  useStudyReminders();
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1, flexDirection: wideLayout ? "row" : "column", backgroundColor: activePalette.background }}>
      {wideLayout ? <SideNav /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: wideLayout
            ? { display: "none" }
            : {
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
          name="community"
          options={{
            title: "Community",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="forum-outline" color={color} size={size} />
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
          name="insights"
          options={{
            href: null,
            title: "Insights",
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="map-search-outline" color={color} size={size} />
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
      </View>
      <ForgeMascot />
      <GuidedAppTour />
    </View>
  );
}
