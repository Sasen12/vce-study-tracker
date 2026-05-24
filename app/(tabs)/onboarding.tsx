import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Text } from "react-native-paper";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { markAppGuideSeen } from "@/utils/appGuide";
import { defaultTabRouteFor, loadDefaultTab } from "@/utils/defaultTab";
import { isStudyTimeEvent } from "@/utils/studyEvents";

type GuideAction = "profile" | "calendar" | "study" | "questions" | "close";

const daysUntil = (eventDate: string) => {
  const today = new Date();
  const target = new Date(`${eventDate.slice(0, 10)}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const guidePages = [
  {
    kicker: "First five minutes",
    title: "Set up the map before you study",
    body: "VCE Forge needs a tiny amount of truth before it can protect your week.",
    icon: "map-marker-path" as keyof typeof MaterialCommunityIcons.glyphMap,
    color: palette.info,
    action: "profile" as GuideAction,
    actionLabel: "Open Profile",
    actionIcon: "book-plus-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
    points: [
      "Add the subjects you are actually doing this unit.",
      "Archive dropped subjects later instead of deleting history.",
      "Set target scores only if they help you choose study time."
    ]
  },
  {
    kicker: "Deadline protection",
    title: "Calendar is the panic shield",
    body: "The app cannot plan backwards from a SAC it does not know exists.",
    icon: "calendar-alert" as keyof typeof MaterialCommunityIcons.glyphMap,
    color: palette.warning,
    action: "calendar" as GuideAction,
    actionLabel: "Open Calendar",
    actionIcon: "calendar-plus" as keyof typeof MaterialCommunityIcons.glyphMap,
    points: [
      "Add the next SAC, SAT or exam first.",
      "Use the real date, even if the details are messy.",
      "Home will turn close deadlines into Today Command."
    ]
  },
  {
    kicker: "Study flow",
    title: "One block creates evidence",
    body: "Start with the timer. Ask the coach when stuck. Save what changed.",
    icon: "timer-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
    color: palette.success,
    action: "study" as GuideAction,
    actionLabel: "Open Study",
    actionIcon: "timer-play-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
    points: [
      "Timer keeps the session contained.",
      "Coach helps with the thing in front of you.",
      "Notes and files make future answers more personal."
    ]
  },
  {
    kicker: "Weak topic repair",
    title: "Turn gaps into drills",
    body: "Questions is where vague weakness becomes marked practice.",
    icon: "cards-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
    color: palette.primary,
    action: "questions" as GuideAction,
    actionLabel: "Open Questions",
    actionIcon: "cards-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
    points: [
      "Generate VCE-style questions from one topic.",
      "Save weak answers so the app remembers the pattern.",
      "Use battles when you need pressure, not noise."
    ]
  },
  {
    kicker: "The point",
    title: "It becomes yours as you use it",
    body: "Every session, correction, note and deadline changes what the app recommends next.",
    icon: "fingerprint" as keyof typeof MaterialCommunityIcons.glyphMap,
    color: palette.secondary,
    action: "close" as GuideAction,
    actionLabel: "Enter app",
    actionIcon: "check-circle-outline" as keyof typeof MaterialCommunityIcons.glyphMap,
    points: [
      "Home decides what deserves attention tonight.",
      "Student Map learns strengths and weak areas over time.",
      "XP, streaks and themes reward work without taking over."
    ]
  }
];

export default function OnboardingScreen() {
  const user = useAuthStore((state) => state.user);
  const { subjects, events, sessions, notes, savedQuestions, fetchAll } = useAppStore();
  const [page, setPage] = useState(0);
  const currentPage = guidePages[page] ?? guidePages[0];
  const isLastPage = page >= guidePages.length - 1;

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const hasFutureAssessment = useMemo(
    () => events.some((event) => !event.completed && !isStudyTimeEvent(event) && daysUntil(event.eventDate) >= 0),
    [events]
  );

  const checklist = useMemo(
    () => [
      {
        title: "Subjects added",
        done: subjects.length > 0,
        detail: subjects.length ? `${subjects.length} active` : "Start in Profile"
      },
      {
        title: "Next deadline entered",
        done: hasFutureAssessment,
        detail: hasFutureAssessment ? "Calendar is ready" : "Add one SAC, SAT or exam"
      },
      {
        title: "First block logged",
        done: sessions.length > 0,
        detail: sessions.length ? "Evidence has started" : "Use Study timer once"
      },
      {
        title: "Memory started",
        done: notes.length > 0 || savedQuestions.length > 0,
        detail: notes.length || savedQuestions.length ? "Notes or questions saved" : "Save one note or weak answer"
      }
    ],
    [hasFutureAssessment, notes.length, savedQuestions.length, sessions.length, subjects.length]
  );
  const completedItems = checklist.filter((item) => item.done).length;

  const enterApp = async () => {
    await markAppGuideSeen(user?.id);
    const tab = await loadDefaultTab(user?.id);
    router.replace(defaultTabRouteFor(tab));
  };

  const openAction = (action: GuideAction) => {
    if (action === "close") {
      void enterApp();
      return;
    }
    if (action === "profile") router.push("/(tabs)/profile");
    if (action === "calendar") router.push("/(tabs)/calendar");
    if (action === "study") router.push({ pathname: "/(tabs)/study", params: { mode: "timer" } });
    if (action === "questions") router.push({ pathname: "/(tabs)/questions", params: { mode: "generate" } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Guided start</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Learn the app by using it.
          </Text>
          <Text style={styles.subtitle}>Five quick stops. Skip anytime if you want to explore on your own.</Text>
        </View>
        <Button mode="outlined" icon="close" onPress={enterApp}>
          Skip tutorial
        </Button>
      </View>

      <AppCard style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Setup progress</Text>
          <Text style={styles.progressCount}>
            {completedItems}/{checklist.length}
          </Text>
        </View>
        <View style={styles.checkGrid}>
          {checklist.map((item) => (
            <View key={item.title} style={styles.checkItem}>
              <MaterialCommunityIcons
                name={item.done ? "check-circle" : "circle-outline"}
                color={item.done ? palette.success : palette.muted}
                size={20}
              />
              <View style={styles.flexText}>
                <Text style={[styles.checkTitle, item.done ? styles.checkTitleDone : null]}>{item.title}</Text>
                <Text style={styles.checkDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.pageCard}>
        <View style={styles.pageTop}>
          <View style={[styles.pageIcon, { backgroundColor: `${currentPage.color}18` }]}>
            <MaterialCommunityIcons name={currentPage.icon} color={currentPage.color} size={28} />
          </View>
          <View style={styles.flexText}>
            <Text style={[styles.pageKicker, { color: currentPage.color }]}>
              Step {page + 1} of {guidePages.length} - {currentPage.kicker}
            </Text>
            <Text style={styles.pageTitle}>{currentPage.title}</Text>
          </View>
        </View>
        <Text style={styles.pageBody}>{currentPage.body}</Text>
        <View style={styles.pointList}>
          {currentPage.points.map((point) => (
            <View key={point} style={styles.pointRow}>
              <View style={[styles.pointDot, { backgroundColor: currentPage.color }]} />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
        <View style={styles.pageActions}>
          <Button mode="contained-tonal" icon={currentPage.actionIcon} onPress={() => openAction(currentPage.action)}>
            {currentPage.actionLabel}
          </Button>
        </View>
      </AppCard>

      <View style={styles.bottomBar}>
        <View style={styles.pager}>
          {guidePages.map((item, index) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityState={{ selected: index === page }}
              onPress={() => setPage(index)}
              style={[styles.pagerDot, index === page && { backgroundColor: currentPage.color }]}
            />
          ))}
        </View>
        <View style={styles.navActions}>
          <Button mode="outlined" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))}>
            Back
          </Button>
          <Button
            mode="contained"
            icon={isLastPage ? "check" : "arrow-right"}
            onPress={() => {
              if (isLastPage) {
                void enterApp();
                return;
              }
              setPage((value) => Math.min(guidePages.length - 1, value + 1));
            }}
          >
            {isLastPage ? "Finish" : "Next"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  subtitle: {
    color: palette.muted,
    lineHeight: 21,
    marginTop: 6
  },
  flexText: {
    flex: 1,
    minWidth: 0
  },
  progressCard: {
    gap: 12
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  progressTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  progressCount: {
    color: palette.info,
    fontFamily: "Outfit_700Bold"
  },
  checkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  checkItem: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 10
  },
  checkTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  checkTitleDone: {
    color: palette.success
  },
  checkDetail: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16
  },
  pageCard: {
    gap: 16
  },
  pageTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  pageIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  pageKicker: {
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  pageTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "Outfit_700Bold"
  },
  pageBody: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23
  },
  pointList: {
    gap: 10
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8
  },
  pointText: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    lineHeight: 21
  },
  pageActions: {
    alignItems: "flex-start"
  },
  bottomBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  pager: {
    flexDirection: "row",
    gap: 7
  },
  pagerDot: {
    width: 26,
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  navActions: {
    flexDirection: "row",
    gap: 8
  }
});
