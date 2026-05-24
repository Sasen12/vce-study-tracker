import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native-paper";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { palette } from "@/constants/theme";

const principles = [
  {
    title: "Student-first",
    body: "Built around the real VCE week: SACs, weak areas, notes, panic revision, and inconsistent study.",
    icon: "school-outline"
  },
  {
    title: "Evidence over guessing",
    body: "Deadlines, sessions, mistakes, notes, and memory should decide what gets studied next.",
    icon: "chart-timeline-variant"
  },
  {
    title: "Pressure into action",
    body: "The goal is not to make VCE feel easy. The goal is to make the next move clear.",
    icon: "target"
  }
] as const;

export default function MissionPage() {
  const { width } = useWindowDimensions();
  const isWide = width >= 940;
  const isCompact = width < 720;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}>
        <View style={styles.shell}>
          <MarketingHeader active="mission" isCompact={isCompact} />

          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={styles.heroCopy}>
              <View style={styles.badge}>
                <MaterialCommunityIcons name="flag-variant" color={palette.success} size={18} />
                <Text style={styles.badgeText}>Mission</Text>
              </View>
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Make VCE feel controllable.
              </Text>
              <Text style={styles.heroLead}>
                VCE Forge exists to help Australian VCE students turn scattered pressure into a clear study plan.
              </Text>
              <Text style={styles.heroBody}>
                The goal is simple: help students know what is due, what is weak, what to practise, and what to do
                tonight.
              </Text>
            </View>

            <View style={styles.missionCard}>
              <Text style={styles.cardLabel}>The goal</Text>
              <Text style={styles.cardTitle}>Less guessing. More evidence.</Text>
              <Text style={styles.cardBody}>
                A student should not need five apps, three notebooks, and a panic spiral to decide what deserves the
                next 25 minutes.
              </Text>
              <View style={styles.signalStack}>
                <Signal label="Track the pressure" icon="calendar-alert" color={palette.warning} />
                <Signal label="Find the weak topic" icon="map-search" color="#38BDF8" />
                <Signal label="Start the repair block" icon="timer-outline" color={palette.success} />
              </View>
            </View>
          </View>

          <View style={[styles.statementSection, isWide && styles.statementSectionWide]}>
            <LinearGradient colors={["rgba(124,110,255,0.2)", "rgba(56,189,248,0.08)"]} style={styles.statement}>
              <Text style={styles.statementLabel}>Why it exists</Text>
              <Text style={styles.statementText}>
                VCE is intense because everything matters at once. SAC dates, revision, notes, teacher resources,
                subject weaknesses, and motivation all compete for attention. VCE Forge brings them into one focused
                command centre so students can act before the deadline hits.
              </Text>
            </LinearGradient>

            <View style={styles.promiseCard}>
              <Text style={styles.cardLabel}>The promise</Text>
              <Text style={styles.promiseText}>
                Serious tools, sharp feedback, and a system that respects how messy studying actually gets.
              </Text>
            </View>
          </View>

          <View style={[styles.principleGrid, isWide && styles.principleGridWide]}>
            {principles.map((principle) => (
              <View key={principle.title} style={styles.principleCard}>
                <View style={styles.iconBox}>
                  <MaterialCommunityIcons name={principle.icon} color="#38BDF8" size={24} />
                </View>
                <Text style={styles.principleTitle}>{principle.title}</Text>
                <Text style={styles.principleBody}>{principle.body}</Text>
              </View>
            ))}
          </View>

          <View style={styles.finalCard}>
            <Text style={styles.finalTitle}>Built for students who want a plan before the panic.</Text>
            <Text style={styles.finalBody}>
              Start with your subjects, your SACs, and tonight's study block. VCE Forge turns the rest into signals.
            </Text>
            <View style={styles.ctaRow}>
              <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/register")} style={styles.primaryCta}>
                <MaterialCommunityIcons name="rocket-launch" color="#06111F" size={18} />
                <Text style={styles.primaryCtaText}>Start studying</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push("/contact")} style={styles.secondaryCta}>
                <MaterialCommunityIcons name="message-question-outline" color={palette.text} size={18} />
                <Text style={styles.secondaryCtaText}>Ask a question</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Signal({ label, icon, color }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }) {
  return (
    <View style={styles.signal}>
      <MaterialCommunityIcons name={icon} color={color} size={20} />
      <Text style={styles.signalText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#06111F"
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 38
  },
  scrollContentCompact: {
    paddingHorizontal: 16
  },
  shell: {
    width: "100%",
    maxWidth: 1160,
    gap: 64
  },
  hero: {
    gap: 28
  },
  heroWide: {
    minHeight: 520,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroCopy: {
    flex: 1,
    gap: 17,
    maxWidth: 660
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.28)",
    backgroundColor: "rgba(74,222,128,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  badgeText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  heroTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 64,
    lineHeight: 70
  },
  heroTitleCompact: {
    fontSize: 42,
    lineHeight: 48
  },
  heroLead: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 21,
    lineHeight: 30
  },
  heroBody: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24
  },
  missionCard: {
    flex: 0.82,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    backgroundColor: "rgba(7,20,33,0.88)",
    padding: 20,
    gap: 13
  },
  cardLabel: {
    color: "#38BDF8",
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    textTransform: "uppercase"
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    lineHeight: 34
  },
  cardBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23
  },
  signalStack: {
    gap: 10,
    marginTop: 4
  },
  signal: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  signalText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  statementSection: {
    gap: 16
  },
  statementSectionWide: {
    flexDirection: "row"
  },
  statement: {
    flex: 1.3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.24)",
    padding: 22,
    gap: 12
  },
  statementLabel: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    textTransform: "uppercase"
  },
  statementText: {
    color: palette.text,
    fontSize: 20,
    lineHeight: 30,
    fontFamily: "Outfit_700Bold"
  },
  promiseCard: {
    flex: 0.7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 22,
    gap: 12,
    justifyContent: "center"
  },
  promiseText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    lineHeight: 30
  },
  principleGrid: {
    gap: 14
  },
  principleGridWide: {
    flexDirection: "row"
  },
  principleCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
    gap: 12
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.32)",
    backgroundColor: "rgba(56,189,248,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  principleTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 19,
    lineHeight: 25
  },
  principleBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21
  },
  finalCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
    backgroundColor: "rgba(56,189,248,0.06)",
    padding: 24,
    gap: 14,
    marginBottom: 18
  },
  finalTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 34,
    lineHeight: 41,
    maxWidth: 820
  },
  finalBody: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760
  },
  ctaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  primaryCta: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#38BDF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18
  },
  primaryCtaText: {
    color: "#06111F",
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  secondaryCta: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18
  },
  secondaryCtaText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  }
});
