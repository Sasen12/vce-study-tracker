import { useEffect, useMemo, useRef } from "react";
import type { ComponentProps } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native-paper";
import { palette } from "@/constants/theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type FeatureVisual = "deadlines" | "practice" | "coach" | "progress";

type Problem = {
  title: string;
  body: string;
  icon: IconName;
  accent: string;
};

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
  accent: string;
  visual: FeatureVisual;
};

const problems: Problem[] = [
  {
    title: "SAC pressure",
    body: "Dates move fast. Topics blur. The next assessment becomes urgent before the plan exists.",
    icon: "calendar-alert",
    accent: palette.warning
  },
  {
    title: "Weak topics hide",
    body: "The thing you avoided in March has a habit of appearing in May with marks attached.",
    icon: "target-variant",
    accent: palette.secondary
  },
  {
    title: "Study gets scattered",
    body: "Notes, files, drills, timers, reminders, and motivation all live in different places.",
    icon: "file-document-multiple",
    accent: "#38BDF8"
  }
];

const features: Feature[] = [
  {
    eyebrow: "SAC radar",
    title: "Turn panic into a plan before the SAC hits.",
    body: "Countdowns, assessment pressure, and SAC Panic Mode keep the next deadline visible and actionable.",
    icon: "alarm-light",
    accent: palette.warning,
    visual: "deadlines"
  },
  {
    eyebrow: "AI question forge",
    title: "Turn weak topics into VCE-style drills.",
    body: "Generate practice questions from topics, common mistakes, key knowledge, and uploaded resources.",
    icon: "auto-fix",
    accent: "#38BDF8",
    visual: "practice"
  },
  {
    eyebrow: "Adaptive study coach",
    title: "Study what actually needs attention tonight.",
    body: "The coach uses deadlines, study sessions, notes, mistakes, and Student Map signals to pick the next useful move.",
    icon: "brain",
    accent: "#A78BFA",
    visual: "coach"
  },
  {
    eyebrow: "Focus and progress",
    title: "Make consistency feel earned.",
    body: "Focus timers, XP, streaks, badges, themes, and the shop turn repeat study into visible momentum.",
    icon: "timer-outline",
    accent: palette.success,
    visual: "progress"
  }
];

const steps = [
  {
    title: "Add subjects",
    body: "Load your VCE stack.",
    icon: "plus-box-multiple" as IconName
  },
  {
    title: "Track deadlines",
    body: "Keep SACs and exams visible.",
    icon: "calendar-clock" as IconName
  },
  {
    title: "Study with tools",
    body: "Timer, coach, notes, files, questions.",
    icon: "timer-sand" as IconName
  },
  {
    title: "Repair weak spots",
    body: "Use feedback and memory to improve.",
    icon: "trending-up" as IconName
  }
];

const outcomes = [
  {
    title: "Know what to study tonight",
    body: "Deadlines and weak topics point to the next block.",
    icon: "weather-night" as IconName
  },
  {
    title: "Stop forgetting SAC dates",
    body: "The next assessment stays visible before it becomes a crisis.",
    icon: "calendar-check" as IconName
  },
  {
    title: "Less guessing. More evidence.",
    body: "Sessions, mistakes, notes, and progress shape the plan.",
    icon: "map-search" as IconName
  }
];

export function ProductLandingPage() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompact = width < 720;
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [scan]);

  const scanStyle = useMemo(
    () => ({
      transform: [
        {
          translateX: scan.interpolate({
            inputRange: [0, 1],
            outputRange: [-160, isCompact ? 360 : 610]
          })
        }
      ],
      opacity: scan.interpolate({
        inputRange: [0, 0.16, 0.72, 1],
        outputRange: [0, 0.38, 0.14, 0]
      })
    }),
    [isCompact, scan]
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}>
        <View style={styles.shell}>
          <Header isCompact={isCompact} />

          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
              <View style={styles.badge}>
                <MaterialCommunityIcons name="pulse" color={palette.success} size={18} />
                <Text style={styles.badgeText}>Built for the messy reality of VCE</Text>
              </View>
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Survive VCE. Master the next SAC.
              </Text>
              <Text style={styles.heroLead}>
                Your SACs, study sessions, weak topics, notes, AI drills, and revision plan in one place.
              </Text>
              <Text style={styles.heroBody}>
                VCE Pulse is a study command centre for Year 11 and Year 12 students who need tonight's plan, not
                another blank planner.
              </Text>
              <View style={styles.ctaRow}>
                <CtaButton label="Start studying" icon="rocket-launch" variant="primary" onPress={() => router.push("/(auth)/register")} />
                <CtaButton label="Log in" icon="login" variant="secondary" onPress={() => router.push("/(auth)/login")} />
              </View>
              <View style={styles.signalRow}>
                <Signal label="Next SAC" value="5 days" accent={palette.warning} />
                <Signal label="Tonight" value="25m repair" accent="#38BDF8" />
                <Signal label="Progress" value="XP + streaks" accent={palette.success} />
              </View>
            </View>

            <HeroPreview isCompact={isCompact} scanStyle={scanStyle} />
          </View>

          <SectionHeader
            label="The problem"
            title="VCE does not fail neatly."
            body="It piles up: SACs, weak topics, random notes, forgotten deadlines, and panic revision. VCE Pulse turns that mess into a single command centre."
          />
          <View style={[styles.problemGrid, isWide && styles.problemGridWide]}>
            {problems.map((problem) => (
              <ProblemCard key={problem.title} problem={problem} />
            ))}
          </View>

          <View style={styles.featureStack}>
            {features.map((feature, index) => (
              <FeatureSection
                key={feature.title}
                feature={feature}
                flipped={isWide && index % 2 === 1}
                isWide={isWide}
              />
            ))}
          </View>

          <View style={[styles.howSection, isWide && styles.howSectionWide]}>
            <View style={styles.howCopy}>
              <Text style={styles.sectionLabel}>How it works</Text>
              <Text style={styles.sectionTitle}>One loop. No theatre.</Text>
              <Text style={styles.sectionBody}>
                Add the subjects, protect the dates, study with the tools, then use feedback to choose the next move.
              </Text>
            </View>
            <View style={styles.stepGrid}>
              {steps.map((step, index) => (
                <StepCard key={step.title} step={step} index={index + 1} />
              ))}
            </View>
          </View>

          <SectionHeader
            label="Student outcomes"
            title="The jobs students actually need done."
            body="No fake testimonials. Just the outcomes that make a week of VCE feel survivable."
          />
          <View style={[styles.outcomeGrid, isWide && styles.outcomeGridWide]}>
            {outcomes.map((outcome) => (
              <OutcomeCard key={outcome.title} outcome={outcome} />
            ))}
          </View>

          <FinalCta isCompact={isCompact} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ isCompact }: { isCompact: boolean }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.brand}>
        <LinearGradient colors={[palette.primary, "#38BDF8", palette.success]} style={styles.logo}>
          <View style={styles.logoCore} />
        </LinearGradient>
        <View>
          <Text style={styles.brandName}>VCE Pulse</Text>
          <Text style={styles.brandMeta}>Study command centre</Text>
        </View>
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/login")} style={styles.headerButton}>
          <MaterialCommunityIcons name="login" color={palette.text} size={17} />
          {!isCompact ? <Text style={styles.headerButtonText}>Log in</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/register")} style={styles.headerPrimary}>
          <MaterialCommunityIcons name="account-plus" color="#06111F" size={17} />
          <Text style={styles.headerPrimaryText}>Start</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CtaButton({
  label,
  icon,
  variant,
  onPress
}: {
  label: string;
  icon: IconName;
  variant: "primary" | "secondary";
  onPress: () => void;
}) {
  const primary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.ctaButton,
        primary ? styles.ctaPrimary : styles.ctaSecondary,
        pressed && styles.pressed
      ]}
    >
      {primary ? <LinearGradient colors={["#38BDF8", palette.primary]} style={StyleSheet.absoluteFillObject} /> : null}
      <MaterialCommunityIcons name={icon} color={primary ? "#06111F" : palette.text} size={18} />
      <Text style={[styles.ctaText, primary && styles.ctaTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function Signal({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.signal}>
      <Text style={[styles.signalValue, { color: accent }]}>{value}</Text>
      <Text style={styles.signalLabel}>{label}</Text>
    </View>
  );
}

function HeroPreview({
  isCompact,
  scanStyle
}: {
  isCompact: boolean;
  scanStyle: {
    transform: { translateX: Animated.AnimatedInterpolation<string | number> }[];
    opacity: Animated.AnimatedInterpolation<string | number>;
  };
}) {
  return (
    <View style={[styles.previewFrame, isCompact && styles.previewFrameCompact]}>
      <Animated.View pointerEvents="none" style={[styles.previewScan, scanStyle]} />

      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewDate}>Saturday 23 May</Text>
          <Text style={styles.previewTitle}>Tonight's command centre</Text>
        </View>
        <View style={styles.streak}>
          <MaterialCommunityIcons name="fire" color={palette.success} size={18} />
          <Text style={styles.streakText}>0 day streak</Text>
        </View>
      </View>

      <View style={styles.previewHeroCard}>
        <View>
          <Text style={styles.previewEyebrow}>NEXT THREAT</Text>
          <Text style={styles.previewBig}>Business Management SAC</Text>
          <Text style={styles.previewMuted}>Operations Management in 5 days</Text>
        </View>
        <View style={styles.countdown}>
          <Text style={styles.countdownNumber}>5</Text>
          <Text style={styles.countdownLabel}>days</Text>
        </View>
      </View>

      <View style={styles.planPanel}>
        <View style={styles.planLine}>
          <View style={[styles.planDot, { backgroundColor: palette.warning }]} />
          <Text style={styles.planText}>Rewrite one weak topic into 5 bullet points</Text>
        </View>
        <View style={styles.planLine}>
          <View style={[styles.planDot, { backgroundColor: "#38BDF8" }]} />
          <Text style={styles.planText}>Forge 3 medium VCE-style questions</Text>
        </View>
        <View style={styles.planLine}>
          <View style={[styles.planDot, { backgroundColor: palette.success }]} />
          <Text style={styles.planText}>Run a 25 minute repair session</Text>
        </View>
      </View>

      <View style={styles.previewFooter}>
        <PreviewTile icon="brain" label="Coach" value="Fix it" accent="#A78BFA" />
        <PreviewTile icon="map-search" label="Student Map" value="Lvl 3" accent={palette.warning} />
        <PreviewTile icon="auto-fix" label="Question forge" value="Ready" accent="#38BDF8" />
      </View>
    </View>
  );
}

function PreviewTile({ icon, label, value, accent }: { icon: IconName; label: string; value: string; accent: string }) {
  return (
    <View style={styles.previewTile}>
      <MaterialCommunityIcons name={icon} color={accent} size={19} />
      <Text style={styles.previewTileLabel}>{label}</Text>
      <Text style={styles.previewTileValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function ProblemCard({ problem }: { problem: Problem }) {
  return (
    <View style={styles.problemCard}>
      <View style={[styles.iconBox, { borderColor: `${problem.accent}55`, backgroundColor: `${problem.accent}1A` }]}>
        <MaterialCommunityIcons name={problem.icon} color={problem.accent} size={23} />
      </View>
      <Text style={styles.problemTitle}>{problem.title}</Text>
      <Text style={styles.problemBody}>{problem.body}</Text>
    </View>
  );
}

function FeatureSection({
  feature,
  flipped,
  isWide
}: {
  feature: Feature;
  flipped: boolean;
  isWide: boolean;
}) {
  const copy = (
    <View style={styles.featureCopy}>
      <View style={styles.featureEyebrowRow}>
        <View style={[styles.featureIcon, { borderColor: `${feature.accent}55`, backgroundColor: `${feature.accent}1A` }]}>
          <MaterialCommunityIcons name={feature.icon} color={feature.accent} size={22} />
        </View>
        <Text style={[styles.featureEyebrow, { color: feature.accent }]}>{feature.eyebrow}</Text>
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureBody}>{feature.body}</Text>
    </View>
  );

  const visual = <FeatureVisualPanel visual={feature.visual} accent={feature.accent} />;

  return (
    <View style={[styles.featureSection, isWide && styles.featureSectionWide]}>
      {flipped ? visual : copy}
      {flipped ? copy : visual}
    </View>
  );
}

function FeatureVisualPanel({ visual, accent }: { visual: FeatureVisual; accent: string }) {
  if (visual === "deadlines") {
    return (
      <View style={styles.visualPanel}>
        <View style={styles.radarTop}>
          <View>
            <Text style={styles.visualLabel}>Assessment radar</Text>
            <Text style={styles.visualTitle}>Next SAC in 5 days</Text>
          </View>
          <MaterialCommunityIcons name="alarm-light" color={accent} size={28} />
        </View>
        <View style={styles.threatBar}>
          <View style={[styles.threatFill, { backgroundColor: accent }]} />
        </View>
        <MiniAction label="Plan the first repair block" icon="clipboard-list-outline" accent={accent} />
        <MiniAction label="Protect the deadline on calendar" icon="calendar-check" accent="#38BDF8" />
      </View>
    );
  }

  if (visual === "practice") {
    return (
      <View style={styles.visualPanel}>
        <View style={styles.forgeHeader}>
          <Text style={styles.visualLabel}>Question forge</Text>
          <View style={styles.smallPill}>
            <Text style={styles.smallPillText}>Medium x 3</Text>
          </View>
        </View>
        <View style={styles.questionDraft}>
          <Text style={styles.questionTag}>AI-BUILT DRAFT</Text>
          <Text style={styles.questionText}>Explain one operations strategy and justify how it improves efficiency.</Text>
        </View>
        <View style={styles.resourceStrip}>
          <MaterialCommunityIcons name="file-upload-outline" color={accent} size={18} />
          <Text style={styles.resourceText}>Uses uploaded SAC, notes, or teacher material</Text>
        </View>
      </View>
    );
  }

  if (visual === "coach") {
    return (
      <View style={styles.visualPanel}>
        <Text style={styles.visualLabel}>Tonight's repair order</Text>
        <CoachBar subject="Business Management" value="72%" accent={accent} />
        <CoachBar subject="General Mathematics" value="56%" accent={palette.secondary} />
        <CoachBar subject="English" value="42%" accent="#38BDF8" />
        <View style={styles.coachNudge}>
          <MaterialCommunityIcons name="map-marker-path" color={palette.warning} size={18} />
          <Text style={styles.coachNudgeText}>Pattern spotted: Operations Management needs the next repair.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.visualPanel}>
      <View style={styles.timerFace}>
        <Text style={styles.timerTime}>25:00</Text>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { backgroundColor: accent }]} />
        </View>
      </View>
      <View style={styles.progressStats}>
        <SmallStat label="XP" value="+32" color={accent} />
        <SmallStat label="Streak" value="+1" color={palette.success} />
        <SmallStat label="Coins" value="+8" color={palette.warning} />
      </View>
      <View style={styles.themePreview}>
        <View style={[styles.themeLine, { backgroundColor: palette.primary, width: "74%" }]} />
        <View style={[styles.themeLine, { backgroundColor: "#38BDF8", width: "52%" }]} />
      </View>
    </View>
  );
}

function MiniAction({ label, icon, accent }: { label: string; icon: IconName; accent: string }) {
  return (
    <View style={styles.miniAction}>
      <MaterialCommunityIcons name={icon} color={accent} size={18} />
      <Text style={styles.miniActionText}>{label}</Text>
    </View>
  );
}

function CoachBar({ subject, value, accent }: { subject: string; value: `${number}%`; accent: string }) {
  return (
    <View style={styles.coachBar}>
      <View style={styles.coachBarHeader}>
        <Text style={styles.coachSubject}>{subject}</Text>
        <Text style={styles.coachValue}>{value}</Text>
      </View>
      <View style={styles.coachTrack}>
        <View style={[styles.coachFill, { width: value, backgroundColor: accent }]} />
      </View>
    </View>
  );
}

function SmallStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.smallStat}>
      <Text style={[styles.smallStatValue, { color }]}>{value}</Text>
      <Text style={styles.smallStatLabel}>{label}</Text>
    </View>
  );
}

function StepCard({
  step,
  index
}: {
  step: {
    title: string;
    body: string;
    icon: IconName;
  };
  index: number;
}) {
  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepIndex}>0{index}</Text>
      <MaterialCommunityIcons name={step.icon} color="#38BDF8" size={22} />
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepBody}>{step.body}</Text>
      </View>
    </View>
  );
}

function OutcomeCard({
  outcome
}: {
  outcome: {
    title: string;
    body: string;
    icon: IconName;
  };
}) {
  return (
    <View style={styles.outcomeCard}>
      <MaterialCommunityIcons name={outcome.icon} color="#38BDF8" size={26} />
      <Text style={styles.outcomeTitle}>{outcome.title}</Text>
      <Text style={styles.outcomeBody}>{outcome.body}</Text>
    </View>
  );
}

function FinalCta({ isCompact }: { isCompact: boolean }) {
  return (
    <LinearGradient colors={["rgba(124,110,255,0.22)", "rgba(56,189,248,0.13)"]} style={styles.finalCta}>
      <View style={styles.finalInner}>
        <Text style={styles.finalLabel}>VCE Pulse</Text>
        <Text style={[styles.finalTitle, isCompact && styles.finalTitleCompact]}>
          Register before the next SAC becomes damage control.
        </Text>
        <Text style={styles.finalBody}>
          Build the command centre now. Track the dates, run the drills, protect the streak, and walk in with a plan.
        </Text>
        <View style={styles.ctaRow}>
          <CtaButton label="Start studying" icon="account-plus" variant="primary" onPress={() => router.push("/(auth)/register")} />
          <CtaButton label="Log in" icon="login-variant" variant="secondary" onPress={() => router.push("/(auth)/login")} />
        </View>
      </View>
    </LinearGradient>
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
    gap: 74
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  headerButton: {
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
  headerButtonText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  headerPrimary: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#38BDF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 15
  },
  headerPrimaryText: {
    color: "#06111F",
    fontFamily: "Outfit_700Bold"
  },
  hero: {
    gap: 36,
    alignItems: "center"
  },
  heroWide: {
    minHeight: 630,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  heroCopy: {
    width: "100%",
    gap: 18
  },
  heroCopyWide: {
    flex: 0.92,
    maxWidth: 570
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
    fontSize: 66,
    lineHeight: 72
  },
  heroTitleCompact: {
    fontSize: 42,
    lineHeight: 48
  },
  heroLead: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 21,
    lineHeight: 30,
    maxWidth: 620
  },
  heroBody: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 610
  },
  ctaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center"
  },
  ctaButton: {
    minHeight: 50,
    minWidth: 148,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18
  },
  ctaPrimary: {
    borderColor: "rgba(56,189,248,0.6)",
    backgroundColor: "#38BDF8"
  },
  ctaSecondary: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  ctaText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  ctaTextPrimary: {
    color: "#06111F"
  },
  pressed: {
    opacity: 0.78,
    transform: [{ translateY: 1 }]
  },
  signalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  signal: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 13,
    paddingVertical: 11,
    minWidth: 118
  },
  signalValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  signalLabel: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  previewFrame: {
    width: "100%",
    maxWidth: 590,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "#071421",
    padding: 18,
    gap: 14,
    overflow: "hidden"
  },
  previewFrameCompact: {
    maxWidth: 620
  },
  previewScan: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 84,
    backgroundColor: "rgba(56,189,248,0.14)"
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  previewDate: {
    color: palette.muted,
    fontSize: 12
  },
  previewTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 25,
    marginTop: 2
  },
  streak: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
    backgroundColor: "rgba(74,222,128,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  streakText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  previewHeroCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.28)",
    backgroundColor: "rgba(245,158,11,0.08)",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  previewEyebrow: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  previewBig: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 24,
    marginTop: 4
  },
  previewMuted: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 4
  },
  countdown: {
    width: 72,
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  countdownNumber: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 32,
    lineHeight: 36
  },
  countdownLabel: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  planPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 14,
    gap: 11
  },
  planLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  planDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  planText: {
    flex: 1,
    color: palette.text,
    fontSize: 13,
    lineHeight: 18
  },
  previewFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  previewTile: {
    flex: 1,
    minWidth: 145,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 11,
    gap: 4
  },
  previewTileLabel: {
    color: palette.muted,
    fontSize: 12
  },
  previewTileValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  sectionHeader: {
    maxWidth: 780,
    gap: 10
  },
  sectionLabel: {
    color: "#38BDF8",
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 36,
    lineHeight: 43
  },
  sectionBody: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24
  },
  problemGrid: {
    gap: 14
  },
  problemGridWide: {
    flexDirection: "row"
  },
  problemCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
    gap: 12
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  problemTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 19,
    lineHeight: 25
  },
  problemBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21
  },
  featureStack: {
    gap: 26
  },
  featureSection: {
    gap: 22,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 26
  },
  featureSectionWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 38
  },
  featureCopy: {
    flex: 1,
    gap: 12
  },
  featureEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  featureEyebrow: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  featureTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 29,
    lineHeight: 36,
    maxWidth: 540
  },
  featureBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 560
  },
  visualPanel: {
    flex: 1,
    minHeight: 250,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.16)",
    backgroundColor: "rgba(7,20,33,0.84)",
    padding: 16,
    gap: 13,
    justifyContent: "center"
  },
  radarTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  visualLabel: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  visualTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    marginTop: 4
  },
  threatBar: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  threatFill: {
    width: "72%",
    height: "100%"
  },
  miniAction: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  miniActionText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  forgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  smallPill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.3)",
    backgroundColor: "rgba(56,189,248,0.1)",
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  smallPillText: {
    color: "#38BDF8",
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  questionDraft: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.34)",
    backgroundColor: "rgba(245,158,11,0.08)",
    padding: 13,
    gap: 7
  },
  questionTag: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  questionText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22
  },
  resourceStrip: {
    borderRadius: 8,
    backgroundColor: "rgba(56,189,248,0.1)",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  resourceText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 17
  },
  coachBar: {
    gap: 7
  },
  coachBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  coachSubject: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  coachValue: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  coachTrack: {
    height: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  coachFill: {
    height: "100%"
  },
  coachNudge: {
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.09)",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  coachNudgeText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 17
  },
  timerFace: {
    alignItems: "center",
    gap: 14
  },
  timerTime: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 54,
    lineHeight: 58
  },
  timerTrack: {
    width: "100%",
    height: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  timerFill: {
    width: "44%",
    height: "100%"
  },
  progressStats: {
    flexDirection: "row",
    gap: 9
  },
  smallStat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  smallStatValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  smallStatLabel: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2
  },
  themePreview: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.055)",
    padding: 11,
    gap: 7
  },
  themeLine: {
    height: 8,
    borderRadius: 8
  },
  howSection: {
    gap: 24
  },
  howSectionWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 42
  },
  howCopy: {
    flex: 0.8,
    gap: 10
  },
  stepGrid: {
    flex: 1,
    gap: 10
  },
  stepCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  stepIndex: {
    color: "rgba(56,189,248,0.56)",
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  stepText: {
    flex: 1,
    gap: 2
  },
  stepTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  stepBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18
  },
  outcomeGrid: {
    gap: 14
  },
  outcomeGridWide: {
    flexDirection: "row"
  },
  outcomeCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)",
    backgroundColor: "rgba(56,189,248,0.055)",
    padding: 18,
    gap: 10
  },
  outcomeTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 19,
    lineHeight: 25
  },
  outcomeBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  finalCta: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.24)",
    overflow: "hidden",
    marginBottom: 18
  },
  finalInner: {
    padding: 26,
    gap: 15,
    backgroundColor: "rgba(6,17,31,0.62)"
  },
  finalLabel: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  finalTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 42,
    lineHeight: 49,
    maxWidth: 860
  },
  finalTitleCompact: {
    fontSize: 30,
    lineHeight: 36
  },
  finalBody: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760
  }
});
