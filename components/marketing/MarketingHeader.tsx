import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";

type ActivePage = "home" | "mission" | "contact";

type MarketingHeaderProps = {
  active: ActivePage;
  isCompact: boolean;
};

const navItems: { label: string; href: "/" | "/mission" | "/contact"; active: ActivePage }[] = [
  { label: "Home", href: "/", active: "home" },
  { label: "Mission", href: "/mission", active: "mission" },
  { label: "Contact", href: "/contact", active: "contact" }
];

export function MarketingHeader({ active, isCompact }: MarketingHeaderProps) {
  const displayName = useAuthStore((state) => state.user?.displayName);
  const loginLabel = displayName ? `Ready to study, ${firstName(displayName)}` : "Log in";
  const signupLabel = isCompact ? "Sign up" : "Create account";

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.brand}>
          <LinearGradient colors={[palette.primary, "#38BDF8", palette.success]} style={styles.logo}>
            <View style={styles.logoCore} />
          </LinearGradient>
          <View>
            <Text style={styles.brandName}>VCE Forge</Text>
            <Text style={styles.brandMeta}>Study command centre</Text>
          </View>
        </Pressable>

        {!isCompact ? <Nav active={active} /> : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/login")} style={styles.loginButton}>
            <MaterialCommunityIcons name={displayName ? "rocket-launch" : "login"} color={palette.text} size={17} />
            {!isCompact ? <Text style={styles.loginText}>{loginLabel}</Text> : null}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/register")} style={styles.startButton}>
            <MaterialCommunityIcons name="account-plus" color="#06111F" size={17} />
            <Text style={styles.startText}>{signupLabel}</Text>
          </Pressable>
        </View>
      </View>

      {isCompact ? <Nav active={active} compact /> : null}
    </View>
  );
}

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "student";
}

function Nav({ active, compact = false }: { active: ActivePage; compact?: boolean }) {
  return (
    <View style={[styles.nav, compact && styles.navCompact]}>
      {navItems.map((item) => (
        <Pressable
          key={item.href}
          accessibilityRole="button"
          onPress={() => router.push(item.href)}
          style={[styles.navItem, compact && styles.navItemCompact, active === item.active && styles.navItemActive]}
        >
          <Text style={[styles.navText, active === item.active && styles.navTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  logoCore: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#06111F"
  },
  brandName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  brandMeta: {
    color: palette.muted,
    fontSize: 12
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 4
  },
  navCompact: {
    alignSelf: "stretch"
  },
  navItem: {
    minHeight: 34,
    borderRadius: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  navItemCompact: {
    flex: 1
  },
  navItemActive: {
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  navText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  navTextActive: {
    color: palette.text
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  loginButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14
  },
  loginText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  startButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#38BDF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 15
  },
  startText: {
    color: "#06111F",
    fontFamily: "Outfit_700Bold"
  }
});
