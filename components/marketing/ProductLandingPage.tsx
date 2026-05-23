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

type ChaosItem = {
  title: string;
  detail: string;
  icon: IconName;
  accent: string;
};

type Feature = {
  title: string;
  eyebrow: string;
  body: string;
  icon: IconName;
  accent: string;
  visual: FeatureVisualKind;
};

type FeatureVisualKind =
  | "countdown"
  | "questions"
  | "coach"
  | "notes"
  | "timer"
  | "calendar"
  | "map"
  | "shop";

type PercentValue = `${number}%`;

const chaosItems: ChaosItem[] = [
  {
    title: "SAC dates moving in fast",
    detail: "Five subjects. One calendar. Zero room for guesswork.",
    icon: "calendar-alert",
    accent: palette.warning
  },
  {
    title: "Subject overload",
    detail: "English, Methods, Business, Data, Software. All screaming at once.",
    icon: "bookshelf",
    accent: palette.primary
  },
  {
    title: "Random notes everywhere",
    detail: "Docs, photos, slides, dot points, and one half-finished summary.",
    icon: "file-document-multiple",
    accent: palette.info
  },
  {
    title: "Forgotten weak areas",
    detail: "The topic you dodged in March becomes the SAC question in May.",
    icon: "target-variant",
    accent: palette.secondary
  },
  {
    title: "Panic revision",
    detail: "Three nights left and no clean order of attack.",
    icon: "alert-octagon",
    accent: "#FB7185"
  },
  {
    title: "Inconsistent study",
    detail: "Big bursts, long gaps, then a stressful restart.",
    icon: "chart-timeline-variant-shimmer",
    accent: palette.success
  }
];

const features: Feature[] = [
  {
    eyebrow: "SAC countdowns",
    title: "Turn panic into a plan before the SAC hits.",
    body: "See the next assessment, the topic pressure, and the first repair move without hunting through reminders.",
    icon: "alarm-light",
    accent: palette.warning,
    visual: "countdown"
  },
  {
    eyebrow: "AI practice",
    title: "Generate VCE-style drills from the topic that needs work.",
    body: "Build questions around key knowledge, exam revision, common mistakes, and uploaded teacher material.",
    icon: "auto-fix",
    accent: "#38BDF8",
    visual: "questions"
  },
  {
    eyebrow: "Adaptive coach",
    title: "Study what actually needs attention tonight.",
    body: "The coach reads deadlines, sessions, mistakes, notes, and recent effort to suggest the next useful block.",
    icon: "brain",
    accent: "#A78BFA",
    visual: "coach"
  },
  {
    eyebrow: "Notes and context",
    title: "Keep notes, files, and resources attached to the work.",
    body: "Upload material, write class notes, and give the app better context for practice and revision decisions.",
    icon: "note-text",
    accent: palette.info,
    visual: "notes"
  },
  {
    eyebrow: "Focus timer",
    title: "Deep work that pays back in XP, streaks, and momentum.",
    body: "Run timed sessions by subject, estimate XP, and keep small wins visible enough to repeat.",
    icon: "timer-outline",
    accent: palette.success,
    visual: "timer"
  },
  {
    eyebrow: "Deadline protection",
    title: "A calendar that treats SACs like live threats.",
    body: "Track upcoming assessments, protect the next deadline, and stop losing marks to forgotten dates.",
    icon: "calendar-clock",
    accent: "#F472B6",
    visual: "calendar"
  },
  {
    eyebrow: "Student Map",
    title: "Less guessing. More evidence.",
    body: "Spot weak subjects and repair patterns before they become a bad result.",
    icon: "map-search",
    accent: "#F59E0B",
    visual: "map"
  },
  {
    eyebrow: "Themes and gamification",
    title: "Make consistency feel earned.",
    body: "Coins, badges, XP, titles, streaks, and theme unlocks turn repeat study into visible progress.",
    icon: "shopping-outline",
    accent: "#2DD4BF",
    visual: "shop"
  }
];

const steps = [
  {
    title: "Add subjects",
    detail: "Load your VCE stack with Unit 1/2 or 3/4 subjects, targets, and colours.",
    icon: "plus-box-multiple" as IconName
  },
  {
    title: "Track deadlines",
    detail: "Drop in SACs, exams, reminders, and the topics that will decide the mark.",
    icon: "calendar-plus" as IconName
  },
  {
    title: "Study with tools",
    detail: "Use the timer, coach, notes, files, and AI question forge in one focused loop.",
    icon: "timer-sand" as IconName
  },
  {
    title: "Improve from feedback",
    detail: "Let mistakes, sessions, memory, and weak topics shape the next plan.",
    icon: "trending-up" as IconName
  }
];

const outcomes = [
  {
    title: "Know what to study tonight",
    detail: "Deadlines, weak topics, and recent effort point to the next block.",
    icon: "weather-night" as IconName
  },
  {
    title: "Turn weak topics into drills",
    detail: "Build targeted questions instead of rereading the same page again.",
    icon: "target-account" as IconName
  },
  {
    title: "Stop forgetting SAC dates",
    detail: "The next assessment stays visible before it becomes a crisis.",
    icon: "calendar-check" as IconName
  },
  {
    title: "Keep notes tied to action",
    detail: "Notes, uploaded resources, questions, and plans feed the same study system.",
    icon: "folder-star" as IconName
  }
];

export function ProductLandingPage() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;
  const isCompact = width < 720;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true
        })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scanStyle = useMemo(
    () => ({
      transform: [
        {
          translateX: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [-180, isCompact ? 360 : 620]
          })
        }
      ],
      opacity: pulse.interpolate({
        inputRange: [0, 0.14, 0.7, 1],
        outputRange: [0, 0.45, 0.18, 0]
      })
    }),
    [isCompact, pulse]
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}>
        <View style={styles.pageShell}>
          <Header isCompact={isCompact} />

          <View style={[styles.hero, isWide ? styles.heroWide : styles.heroStack]}>
            <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
              <View style={styles.heroBadge}>
                <MaterialCommunityIcons name="pulse" color={palette.success} size={18} />
                <Text style={styles.heroBadgeText}>Built for the messy reality of VCE</Text>
              </View>
              <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                Survive VCE. Master the next SAC.
              </Text>
              <Text style={styles.heroLead}>
                Your SACs, study sessions, weak topics, notes, AI drills, and revision plan in one place.
              </Text>
              <Text style={styles.heroSubcopy}>
                VCE Pulse combines deadline tracking, AI practice questions, adaptive study planning, notes, focus
                timers, XP, streaks, badges, themes, and community into one serious study command centre.
              </Text>
              <View style={styles.ctaRow}>
                <CtaButton label="Start studying" icon="rocket-launch" variant="primary" onPress={() => router.push("/(auth)/register")} />
                <CtaButton label="Log in" icon="login" variant="secondary" onPress={() => router.push("/(auth)/login")} />
              </View>
              <View style={styles.heroStats}>
                <Metric label="next SAC" value="5d" accent={palette.warning} />
                <Metric label="study target" value="16h" accent={palette.info} />
                <Metric label="streak engine" value="XP" accent={palette.success} />
              </View>
            </View>

            <HeroPreview isCompact={isCompact} scanStyle={scanStyle} />
          </View>

          <SectionHeader
            label="The VCE problem"
            title="Too much is happening at once."
            body="The app is built around the moments students actually live through: the SAC countdown, the weak topic you keep avoiding, the messy note pile, and the night where guessing is not a strategy."
          />
          <View style={[styles.chaosGrid, isWide && styles.threeColumnGrid]}>
            {chaosItems.map((item) => (
              <ChaosCard key={item.title} item={item} />
            ))}
          </View>

          <SectionHeader
            label="Product system"
            title="Every tool points back to the next useful study move."
            body="VCE Pulse is not another blank planner. It keeps evidence close: deadlines, resources, sessions, notes, generated questions, weak areas, XP, and memory."
          />
          <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
            {features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} isWide={isWide} />
            ))}
          </View>

          <View style={[styles.howSection, isWide && styles.howSectionWide]}>
            <View style={styles.howCopy}>
              <Text style={styles.sectionLabel}>How it works</Text>
              <Text style={styles.sectionTitle}>From scattered pressure to one clean study loop.</Text>
              <Text style={styles.sectionBody}>
                Add the subjects, protect the deadlines, study inside the timer and coach, then let feedback sharpen
                the next session.
              </Text>
            </View>
            <View style={styles.steps}>
              {steps.map((step, index) => (
                <StepCard key={step.title} step={step} index={index + 1} />
              ))}
            </View>
          </View>

          <SectionHeader
            label="Student outcomes"
            title="No fake testimonials. Just the jobs students need done."
            body="The value is simple: less guessing, fewer missed dates, better drills, and a clearer plan when the pressure spikes."
          />
          <View style={[styles.outcomeGrid, isWide && styles.outcomeGridWide]}>
            {outcomes.map((outcome) => (
              <OutcomeCard key={outcome.title} outcome={outcome} />
            ))}
          </View>

          <LinearGradient colors={["rgba(124,110,255,0.22)", "rgba(56,189,248,0.12)", "rgba(74,222,128,0.08)"]} style={styles.finalCta}>
            <View style={styles.finalCtaInner}>
              <Text style={styles.finalLabel}>VCE Pulse</Text>
              <Text style={[styles.finalTitle, isCompact && styles.finalTitleCompact]}>
                Register before the next SAC becomes everyone else's emergency.
              </Text>
              <Text style={styles.finalBody}>
                Build the command centre now. Track the deadlines, run the drills, protect the study streak, and walk
                into the next assessment with a plan.
              </Text>
              <View style={styles.ctaRow}>
                <CtaButton label="Start studying" icon="account-plus" variant="primary" onPress={() => router.push("/(auth)/register")} />
                <CtaButton label="Log in" icon="login-variant" variant="ghost" onPress={() => router.push("/(auth)/login")} />
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ isCompact }: { isCompact: boolean }) {
  return (
    <View style={[styles.header, isCompact && styles.headerCompact]}>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.brandLockup}>
        <LinearGradient colors={[palette.primary, "#38BDF8", palette.success]} style={styles.logoMark}>
          <View style={styles.logoCore} />
        </LinearGradient>
        <View>
          <Text style={styles.brandName}>VCE Pulse</Text>
          <Text style={styles.brandMeta}>Study command centre</Text>
        </View>
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/login")} style={styles.headerLink}>
          <MaterialCommunityIcons name="login" color={palette.text} size={17} />
          {!isCompact ? <Text style={styles.headerLinkText}>Log in</Text> : null}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/register")} style={styles.headerPrimary}>
          <MaterialCommunityIcons name="rocket-launch" color="#07111F" size={17} />
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
  variant: "primary" | "secondary" | "ghost";
  onPress: () => void;
}) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.ctaButton,
        isPrimary && styles.ctaPrimary,
        variant === "secondary" && styles.ctaSecondary,
        variant === "ghost" && styles.ctaGhost,
        pressed && styles.pressed
      ]}
    >
      {isPrimary ? (
        <LinearGradient colors={["#38BDF8", palette.primary]} style={StyleSheet.absoluteFillObject} />
      ) : null}
      <MaterialCommunityIcons name={icon} color={isPrimary ? "#06111F" : palette.text} size={18} />
      <Text style={[styles.ctaText, isPrimary && styles.ctaPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
    <View style={[styles.previewWrap, isCompact && styles.previewWrapCompact]}>
      <View style={styles.previewGlow} />
      <View style={styles.previewShell}>
        <Animated.View pointerEvents="none" style={[styles.previewScan, scanStyle]} />
        <View style={styles.previewTopBar}>
          <View>
            <Text style={styles.previewDate}>Saturday 23 May</Text>
            <Text style={styles.previewGreeting}>Hey sasen</Text>
          </View>
          <View style={styles.streakPill}>
            <MaterialCommunityIcons name="fire" color={palette.success} size={18} />
            <Text style={styles.streakNumber}>0</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" color={palette.muted} size={22} />
          <Text style={styles.searchText}>Search notes, questions, files, events</Text>
          <View style={styles.mapBadge}>
            <MaterialCommunityIcons name="map-search" color={palette.warning} size={16} />
            <Text style={styles.mapBadgeText}>Lvl 3 Student Map</Text>
          </View>
        </View>

        <View style={styles.sparkPanel}>
          <View style={styles.panelEyebrowRow}>
            <MaterialCommunityIcons name="lightbulb-on-outline" color={palette.warning} size={17} />
            <Text style={styles.panelEyebrow}>DAILY SPARK</Text>
          </View>
          <Text style={styles.sparkTitle}>Small study sessions still count when they are done consistently.</Text>
          <Text style={styles.sparkBody}>Business Management SAC: review one key topic, then write 3 exam-style questions.</Text>
        </View>

        <View style={styles.previewRow}>
          <View style={[styles.previewPanel, styles.panicPanel]}>
            <View style={styles.previewPanelHeader}>
              <MaterialCommunityIcons name="alert" color={palette.warning} size={18} />
              <Text style={styles.previewPanelTitle}>SAC Panic Mode</Text>
            </View>
            <Text style={styles.previewPanelBody}>Business Operations Management SAC is in 5 days.</Text>
            <View style={styles.previewAction}>
              <MaterialCommunityIcons name="play" color="#07111F" size={15} />
              <Text style={styles.previewActionText}>Start</Text>
            </View>
          </View>

          <View style={[styles.previewPanel, styles.coachPanel]}>
            <View style={styles.previewPanelHeader}>
              <MaterialCommunityIcons name="brain" color={palette.warning} size={18} />
              <Text style={styles.previewPanelTitle}>Weakness Coach</Text>
            </View>
            <Text style={styles.previewPanelBody}>Review Operations Management, then do two similar questions.</Text>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </View>

        <View style={styles.previewBottomGrid}>
          <MiniTile icon="timer-outline" title="Deep work" value="25:00" accent={palette.primary} />
          <MiniTile icon="auto-fix" title="Question forge" value="3 drills" accent="#38BDF8" />
          <MiniTile icon="calendar-clock" title="Radar" value="1 due" accent={palette.warning} />
        </View>
      </View>
    </View>
  );
}

function MiniTile({ icon, title, value, accent }: { icon: IconName; title: string; value: string; accent: string }) {
  return (
    <View style={styles.miniTile}>
      <MaterialCommunityIcons name={icon} color={accent} size={18} />
      <Text style={styles.miniTitle}>{title}</Text>
      <Text style={styles.miniValue}>{value}</Text>
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

function ChaosCard({ item }: { item: ChaosItem }) {
  return (
    <View style={styles.chaosCard}>
      <View style={[styles.iconBox, { backgroundColor: `${item.accent}1F`, borderColor: `${item.accent}55` }]}>
        <MaterialCommunityIcons name={item.icon} color={item.accent} size={22} />
      </View>
      <Text style={styles.chaosTitle}>{item.title}</Text>
      <Text style={styles.chaosDetail}>{item.detail}</Text>
    </View>
  );
}

function FeatureCard({ feature, isWide }: { feature: Feature; isWide: boolean }) {
  return (
    <View style={[styles.featureCard, isWide && styles.featureCardWide]}>
      <View style={styles.featureCopy}>
        <View style={styles.featureEyebrowRow}>
          <View style={[styles.featureIcon, { backgroundColor: `${feature.accent}1F`, borderColor: `${feature.accent}55` }]}>
            <MaterialCommunityIcons name={feature.icon} color={feature.accent} size={21} />
          </View>
          <Text style={[styles.featureEyebrow, { color: feature.accent }]}>{feature.eyebrow}</Text>
        </View>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureBody}>{feature.body}</Text>
      </View>
      <FeatureVisual kind={feature.visual} accent={feature.accent} />
    </View>
  );
}

function FeatureVisual({ kind, accent }: { kind: FeatureVisualKind; accent: string }) {
  if (kind === "countdown") {
    return (
      <View style={styles.visualBox}>
        <View style={styles.countdownMain}>
          <Text style={[styles.countdownNumber, { color: accent }]}>5</Text>
          <View>
            <Text style={styles.visualTitle}>days until SAC</Text>
            <Text style={styles.visualMuted}>Business Operations Management</Text>
          </View>
        </View>
        <TimelineItem accent={accent} label="Repair notes" detail="Summarise one weak topic" />
        <TimelineItem accent={palette.info} label="Forge questions" detail="3 medium exam-style prompts" />
        <TimelineItem accent={palette.success} label="Mark mistakes" detail="Save the correction pattern" />
      </View>
    );
  }

  if (kind === "questions") {
    return (
      <View style={styles.visualBox}>
        <View style={styles.questionTop}>
          <Chip label="Key knowledge" />
          <Chip label="Medium" />
          <Chip label="3" />
        </View>
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>AI-BUILT DRAFT</Text>
          <Text style={styles.questionText}>Explain one operations strategy and justify how it improves efficiency.</Text>
        </View>
        <View style={styles.questionFooter}>
          <View style={[styles.segment, { backgroundColor: `${accent}33` }]} />
          <View style={styles.segment} />
          <View style={styles.segment} />
        </View>
      </View>
    );
  }

  if (kind === "coach") {
    return (
      <View style={styles.visualBox}>
        <Text style={styles.visualTitle}>Tonight's repair order</Text>
        <CoachRow name="Business Management" value="72%" accent={accent} />
        <CoachRow name="General Mathematics" value="58%" accent={palette.secondary} />
        <CoachRow name="English" value="41%" accent={palette.info} />
        <View style={styles.coachNudge}>
          <MaterialCommunityIcons name="help-circle" color={accent} size={16} />
          <Text style={styles.coachNudgeText}>Fix one Timer gap, then practise.</Text>
        </View>
      </View>
    );
  }

  if (kind === "notes") {
    return (
      <View style={styles.visualBox}>
        <ResourceRow icon="file-pdf-box" title="Teacher SAC outline" meta="Uploaded context" accent={palette.secondary} />
        <ResourceRow icon="note-edit" title="Class notes" meta="Operations Management" accent={accent} />
        <ResourceRow icon="image-text" title="Whiteboard photo" meta="Converted into prompts" accent={palette.success} />
        <View style={styles.contextBanner}>
          <Text style={styles.contextBannerText}>Use resources when generating drills</Text>
        </View>
      </View>
    );
  }

  if (kind === "timer") {
    return (
      <View style={styles.visualBox}>
        <View style={styles.timerFace}>
          <Text style={styles.timerTime}>25:00</Text>
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { backgroundColor: accent }]} />
          </View>
        </View>
        <View style={styles.timerStats}>
          <MiniStat label="XP estimated" value="32" color={accent} />
          <MiniStat label="target" value="20%" color={palette.primary} />
          <MiniStat label="streak" value="+1" color={palette.success} />
        </View>
      </View>
    );
  }

  if (kind === "calendar") {
    return (
      <View style={styles.visualBox}>
        <View style={styles.calendarHeader}>
          <Text style={styles.visualTitle}>May 2026</Text>
          <Text style={[styles.calendarDue, { color: accent }]}>1 upcoming</Text>
        </View>
        <View style={styles.calendarGrid}>
          {Array.from({ length: 21 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.calendarDay,
                index === 16 && { backgroundColor: `${palette.primary}DD` },
                index === 18 && { borderColor: accent, borderWidth: 1 }
              ]}
            >
              <Text style={[styles.calendarDayText, index === 16 && styles.calendarDayActiveText]}>{index + 8}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (kind === "map") {
    return (
      <View style={styles.visualBox}>
        <MapRow subject="Business Management" gap="-1.2" accent={accent} />
        <MapRow subject="Data Analytics" gap="-0.8" accent={palette.success} />
        <MapRow subject="English" gap="-0.4" accent={palette.info} />
        <View style={styles.mapFooter}>
          <Text style={styles.mapFooterText}>Weakness pattern spotted</Text>
          <MaterialCommunityIcons name="map-marker-path" color={accent} size={18} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.visualBox}>
      <ThemeSwatch name="Midnight Focus" primary={palette.primary} secondary={palette.secondary} />
      <ThemeSwatch name="Mint Sprint" primary="#34D399" secondary="#60A5FA" />
      <ThemeSwatch name="Ocean Mode" primary="#38BDF8" secondary="#2DD4BF" selected />
      <View style={styles.shopFooter}>
        <MaterialCommunityIcons name="medal-outline" color={accent} size={18} />
        <Text style={styles.shopFooterText}>Coins, badges, titles, streaks</Text>
      </View>
    </View>
  );
}

function TimelineItem({ accent, label, detail }: { accent: string; label: string; detail: string }) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineDot, { backgroundColor: accent }]} />
      <View>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function CoachRow({ name, value, accent }: { name: string; value: PercentValue; accent: string }) {
  return (
    <View style={styles.coachRow}>
      <Text style={styles.coachName}>{name}</Text>
      <View style={styles.coachBarTrack}>
        <View style={[styles.coachBarFill, { width: value, backgroundColor: accent }]} />
      </View>
      <Text style={styles.coachValue}>{value}</Text>
    </View>
  );
}

function ResourceRow({ icon, title, meta, accent }: { icon: IconName; title: string; meta: string; accent: string }) {
  return (
    <View style={styles.resourceRow}>
      <MaterialCommunityIcons name={icon} color={accent} size={22} />
      <View style={styles.resourceText}>
        <Text style={styles.resourceTitle}>{title}</Text>
        <Text style={styles.resourceMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function MapRow({ subject, gap, accent }: { subject: string; gap: string; accent: string }) {
  return (
    <View style={styles.mapRow}>
      <View style={[styles.mapDot, { backgroundColor: accent }]} />
      <Text style={styles.mapSubject}>{subject}</Text>
      <Text style={[styles.mapGap, { color: accent }]}>{gap}</Text>
    </View>
  );
}

function ThemeSwatch({
  name,
  primary,
  secondary,
  selected
}: {
  name: string;
  primary: string;
  secondary: string;
  selected?: boolean;
}) {
  return (
    <View style={[styles.themeSwatch, selected && styles.themeSwatchSelected]}>
      <View style={styles.swatchBars}>
        <View style={[styles.swatchBar, { backgroundColor: primary, width: "72%" }]} />
        <View style={[styles.swatchBar, { backgroundColor: secondary, width: "48%" }]} />
      </View>
      <Text style={styles.themeName}>{name}</Text>
    </View>
  );
}

function StepCard({
  step,
  index
}: {
  step: {
    title: string;
    detail: string;
    icon: IconName;
  };
  index: number;
}) {
  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepNumber}>0{index}</Text>
      <View style={styles.stepIcon}>
        <MaterialCommunityIcons name={step.icon} color={palette.primary} size={22} />
      </View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDetail}>{step.detail}</Text>
      </View>
    </View>
  );
}

function OutcomeCard({
  outcome
}: {
  outcome: {
    title: string;
    detail: string;
    icon: IconName;
  };
}) {
  return (
    <View style={styles.outcomeCard}>
      <MaterialCommunityIcons name={outcome.icon} color="#38BDF8" size={26} />
      <Text style={styles.outcomeTitle}>{outcome.title}</Text>
      <Text style={styles.outcomeDetail}>{outcome.detail}</Text>
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
    paddingBottom: 36
  },
  scrollContentCompact: {
    paddingHorizontal: 16
  },
  pageShell: {
    width: "100%",
    maxWidth: 1180,
    gap: 70
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  headerCompact: {
    minHeight: 66
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  logoCore: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: "#06111F",
    borderRadius: 4
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
  headerLink: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  headerLinkText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  headerPrimary: {
    minHeight: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 15,
    backgroundColor: "#38BDF8"
  },
  headerPrimaryText: {
    color: "#06111F",
    fontFamily: "Outfit_700Bold"
  },
  hero: {
    width: "100%",
    gap: 34,
    alignItems: "center"
  },
  heroWide: {
    minHeight: 640,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  heroStack: {
    flexDirection: "column"
  },
  heroCopy: {
    width: "100%",
    gap: 18
  },
  heroCopyWide: {
    flex: 0.92,
    maxWidth: 560
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.28)",
    backgroundColor: "rgba(74,222,128,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroBadgeText: {
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
    maxWidth: 600
  },
  heroSubcopy: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 620
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
    overflow: "hidden",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18
  },
  ctaPrimary: {
    borderColor: "rgba(56,189,248,0.58)",
    backgroundColor: "#38BDF8"
  },
  ctaSecondary: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  ctaGhost: {
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(6,17,31,0.52)"
  },
  ctaText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  ctaPrimaryText: {
    color: "#06111F"
  },
  pressed: {
    opacity: 0.78,
    transform: [{ translateY: 1 }]
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4
  },
  metric: {
    minWidth: 108,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 13,
    paddingVertical: 11
  },
  metricValue: {
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  previewWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
    position: "relative"
  },
  previewWrapCompact: {
    maxWidth: 620
  },
  previewGlow: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 20,
    bottom: -12,
    borderRadius: 8,
    backgroundColor: "rgba(56,189,248,0.1)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.18)"
  },
  previewShell: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    borderRadius: 8,
    backgroundColor: "#071421",
    padding: 18,
    gap: 14
  },
  previewScan: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 92,
    backgroundColor: "rgba(56,189,248,0.16)"
  },
  previewTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14
  },
  previewDate: {
    color: palette.muted,
    fontSize: 12
  },
  previewGreeting: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    marginTop: 2
  },
  streakPill: {
    minWidth: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.18)",
    backgroundColor: "rgba(74,222,128,0.06)",
    padding: 10,
    alignItems: "center"
  },
  streakNumber: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 20
  },
  streakLabel: {
    color: palette.muted,
    fontSize: 11
  },
  searchBar: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13
  },
  searchText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  mapBadge: {
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.38)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  mapBadgeText: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  sparkPanel: {
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.24)",
    backgroundColor: "rgba(96,165,250,0.09)",
    borderRadius: 8,
    padding: 15,
    gap: 8
  },
  panelEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  panelEyebrow: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  sparkTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 17,
    lineHeight: 23
  },
  sparkBody: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 19
  },
  previewRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap"
  },
  previewPanel: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 9
  },
  panicPanel: {
    borderColor: "rgba(255,107,107,0.32)",
    backgroundColor: "rgba(255,107,107,0.08)"
  },
  coachPanel: {
    borderColor: "rgba(245,158,11,0.32)",
    backgroundColor: "rgba(245,158,11,0.06)"
  },
  previewPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  previewPanelTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  previewPanelBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  previewAction: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    borderRadius: 8,
    backgroundColor: "#38BDF8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center"
  },
  previewActionText: {
    color: "#07111F",
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  progressFill: {
    width: "68%",
    height: "100%",
    backgroundColor: palette.warning
  },
  previewBottomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  miniTile: {
    flex: 1,
    minWidth: 145,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 4
  },
  miniTitle: {
    color: palette.muted,
    fontSize: 12
  },
  miniValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  sectionHeader: {
    width: "100%",
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
  chaosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  threeColumnGrid: {
    alignItems: "stretch"
  },
  chaosCard: {
    flexGrow: 1,
    flexBasis: 300,
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
  chaosTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 24
  },
  chaosDetail: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  featureGrid: {
    gap: 16
  },
  featureGridWide: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  featureCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
    gap: 18
  },
  featureCardWide: {
    flexBasis: "48.8%",
    flexGrow: 1
  },
  featureCopy: {
    gap: 10
  },
  featureEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  featureIcon: {
    width: 38,
    height: 38,
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
    fontSize: 22,
    lineHeight: 29
  },
  featureBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21
  },
  visualBox: {
    minHeight: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.16)",
    backgroundColor: "rgba(7,20,33,0.78)",
    padding: 14,
    gap: 12,
    justifyContent: "center"
  },
  countdownMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 2
  },
  countdownNumber: {
    fontFamily: "Outfit_700Bold",
    fontSize: 54,
    lineHeight: 58
  },
  visualTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 15
  },
  visualMuted: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  timelineItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  timelineLabel: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  timelineDetail: {
    color: palette.muted,
    fontSize: 12
  },
  questionTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  chipText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  questionCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    backgroundColor: "rgba(245,158,11,0.08)",
    padding: 12,
    gap: 6
  },
  questionLabel: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 11
  },
  questionText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20
  },
  questionFooter: {
    flexDirection: "row",
    gap: 8
  },
  segment: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  coachRow: {
    gap: 6
  },
  coachName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  coachBarTrack: {
    height: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden"
  },
  coachBarFill: {
    height: "100%"
  },
  coachValue: {
    color: palette.muted,
    fontSize: 12
  },
  coachNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  coachNudgeText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 11
  },
  resourceText: {
    flex: 1
  },
  resourceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  resourceMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  contextBanner: {
    borderRadius: 8,
    backgroundColor: "rgba(96,165,250,0.12)",
    padding: 10
  },
  contextBannerText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  timerFace: {
    alignItems: "center",
    gap: 14
  },
  timerTime: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 52,
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
  timerStats: {
    flexDirection: "row",
    gap: 8
  },
  miniStat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 9,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  miniStatValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 17
  },
  miniStatLabel: {
    color: palette.muted,
    fontSize: 11
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  calendarDue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  calendarDay: {
    width: 38,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  calendarDayText: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  calendarDayActiveText: {
    color: palette.text
  },
  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingBottom: 10
  },
  mapDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  mapSubject: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  mapGap: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14
  },
  mapFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.09)",
    padding: 11
  },
  mapFooterText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  themeSwatch: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: 10,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.035)"
  },
  themeSwatchSelected: {
    borderColor: "rgba(56,189,248,0.72)"
  },
  swatchBars: {
    gap: 6
  },
  swatchBar: {
    height: 8,
    borderRadius: 8
  },
  themeName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  shopFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "rgba(45,212,191,0.1)",
    padding: 10
  },
  shopFooterText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  howSection: {
    width: "100%",
    gap: 24
  },
  howSectionWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  howCopy: {
    flex: 0.8,
    gap: 10
  },
  steps: {
    flex: 1,
    gap: 12
  },
  stepCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13
  },
  stepNumber: {
    color: "rgba(56,189,248,0.54)",
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,110,255,0.32)",
    backgroundColor: "rgba(124,110,255,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  stepText: {
    flex: 1,
    gap: 3
  },
  stepTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  stepDetail: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19
  },
  outcomeGrid: {
    gap: 14
  },
  outcomeGridWide: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  outcomeCard: {
    flexGrow: 1,
    flexBasis: 250,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
    backgroundColor: "rgba(56,189,248,0.06)",
    padding: 18,
    gap: 10
  },
  outcomeTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 19,
    lineHeight: 25
  },
  outcomeDetail: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  finalCta: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
    overflow: "hidden",
    marginBottom: 18
  },
  finalCtaInner: {
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
