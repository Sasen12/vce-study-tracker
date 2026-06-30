import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { router, usePathname } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { titleLabelById } from "@/constants/gamification";

type NavItem = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  path: string;
  match: string[];
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: "view-dashboard", path: "/(tabs)", match: ["/", "/index"] },
  { label: "Study", icon: "timer-outline", path: "/(tabs)/study", match: ["/study"] },
  { label: "Calendar", icon: "calendar-month", path: "/(tabs)/calendar", match: ["/calendar"] },
  { label: "Community", icon: "forum-outline", path: "/(tabs)/community", match: ["/community"] },
  { label: "Insights", icon: "map-search-outline", path: "/(tabs)/insights", match: ["/insights"] },
  { label: "Shop", icon: "shopping-outline", path: "/(tabs)/shop", match: ["/shop"] },
  { label: "Profile", icon: "account-circle-outline", path: "/(tabs)/profile", match: ["/profile"] },
  { label: "More", icon: "dots-grid", path: "/(tabs)/more", match: ["/more"] }
];

const isActiveRoute = (pathname: string, item: NavItem) => {
  if (item.label === "Home") return pathname === "/" || pathname === "/index" || pathname === "/(tabs)";
  return item.match.some((segment) => pathname.endsWith(segment));
};

export function SideNav() {
  const palette = useActivePalette();
  const pathname = usePathname();
  const gamification = useAppStore((state) => state.gamification);
  const user = useAuthStore((state) => state.user);

  const coins = gamification?.xpBalance ?? 0;
  const level = gamification?.level ?? 1;
  const titleLabel = titleLabelById(gamification?.activeTitle);
  const displayName = user?.displayName ?? "Student";
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";

  return (
    <View style={[styles.sidebar, { backgroundColor: palette.surface, borderRightColor: palette.border }]}>
      <Pressable
        accessibilityRole="button"
        style={styles.brand}
        onPress={() => router.navigate("/(tabs)")}
      >
        <View style={[styles.brandMark, { backgroundColor: palette.primary }]}>
          <MaterialCommunityIcons name="fire" color="#FFFFFF" size={22} />
        </View>
        <View style={styles.brandText}>
          <Text style={[styles.brandTitle, { color: palette.text }]}>VCE Forge</Text>
          <Text style={[styles.brandSubtitle, { color: palette.muted }]}>study tracker</Text>
        </View>
      </Pressable>

      <ScrollView style={styles.navScroll} contentContainerStyle={styles.navList} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const active = isActiveRoute(pathname, item);
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => router.navigate(item.path as never)}
              style={[
                styles.navItem,
                active && { backgroundColor: `${palette.primary}1f` }
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon}
                color={active ? palette.primary : palette.muted}
                size={22}
              />
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? palette.text : palette.muted },
                  active && styles.navLabelActive
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/(tabs)/shop")}
          style={[styles.coinPill, { borderColor: palette.border, backgroundColor: `${palette.primary}14` }]}
        >
          <MaterialCommunityIcons name="circle-multiple" color={palette.primary} size={18} />
          <Text style={[styles.coinValue, { color: palette.text }]}>{coins}</Text>
          <Text style={[styles.coinLabel, { color: palette.muted }]}>coins</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/(tabs)/profile")}
          style={[styles.userCard, { borderColor: palette.border, backgroundColor: "rgba(255,255,255,0.03)" }]}
        >
          <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userText}>
            <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.userMeta, { color: palette.muted }]} numberOfLines={1}>
              {titleLabel} · Lv {level}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    height: "100%",
    borderRightWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 18
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 22
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  brandText: {
    flex: 1,
    minWidth: 0
  },
  brandTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 22
  },
  brandSubtitle: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    letterSpacing: 1
  },
  navScroll: {
    flex: 1
  },
  navList: {
    gap: 4
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  navLabel: {
    fontFamily: "Outfit_400Regular",
    fontSize: 15
  },
  navLabelActive: {
    fontFamily: "Outfit_700Bold"
  },
  footer: {
    gap: 10,
    marginTop: 12
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  coinValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  coinLabel: {
    fontFamily: "Outfit_400Regular",
    fontSize: 13
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  userText: {
    flex: 1,
    minWidth: 0
  },
  userName: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  userMeta: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12
  }
});
