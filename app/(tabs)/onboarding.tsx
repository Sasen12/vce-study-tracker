import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
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
  const { width } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const { subjects, events, sessions, notes, savedQuestions, fetchAll } = useAppStore();
  const [page, setPage] = useState(0);
  const currentPage = guidePages[page] ?? guidePages[0];
  const isLastPage = page >= guidePages.length - 1;
  const isWide = width >= 900;

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
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Guided start</Text>
            <Text variant="headlineLarge" style={styles.title}>
              Get your command centre online.
            </Text>
            <Text style={styles.subtitle}>A short setup path for VCE Forge. Skip it anytime.</Text>
          </View>
          <Button mode="outlined" icon="close" onPress={enterApp}>
            Skip tutorial
          </Button>
        </View>

        <View style={[styles.guideLayout, !isWide && styles.guideLayoutStacked]}>
          <View style={[styles.sideRail, !isWide && styles.sideRailMobile]}>
            <AppCard style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={styles.progressTitle}>Setup pulse</Text>
                  <Text style={styles.progressCaption}>What the app already knows</Text>
                </View>
                <Text style={styles.progressCount}>
                  {completedItems}/{checklist.length}
                </Text>
              </View>
              <View style={styles.checkList}>
                {checklist.map((item) => (
                  <View key={item.title} style={styles.checkItem}>
                    <MaterialCommunityIcons
                      name={item.done ? "check-circle" : "circle-outline"}
                      color={item.done ? palette.success : palette.muted}
                      size={18}
                    />
                    <View style={styles.flexText}>
                      <Text style={[styles.checkTitle, item.done ? styles.checkTitleDone : null]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.checkDetail} numberOfLines={1}>
                        {item.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </AppCard>

            <AppCard style={styles.stepRail}>
              <Text style={styles.progressTitle}>Tutorial route</Text>
              {guidePages.map((item, index) => {
                const active = index === page;
                return (
                  <Pressable
                    key={item.title}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setPage(index)}
                    style={[styles.stepRailItem, active && { borderColor: item.color, backgroundColor: `${item.color}12` }]}
                  >
                    <View style={[styles.stepRailIcon, { backgroundColor: active ? `${item.color}22` : "rgba(255,255,255,0.05)" }]}>
                      <MaterialCommunityIcons name={item.icon} color={active ? item.color : palette.muted} size={17} />
                    </View>
                    <View style={styles.flexText}>
                      <Text style={[styles.stepRailTitle, active && { color: palette.text }]} numberOfLines={1}>
                        {item.kicker}
                      </Text>
                      <Text style={styles.stepRailSubtitle} numberOfLines={1}>
                        Step {index + 1}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </AppCard>
          </View>

          <AppCard style={styles.pageCard}>
            <View style={styles.pageChrome}>
              <View style={styles.pageTop}>
                <View style={[styles.pageIcon, { backgroundColor: `${currentPage.color}18` }]}>
                  <MaterialCommunityIcons name={currentPage.icon} color={currentPage.color} size={30} />
                </View>
                <View style={styles.flexText}>
                  <Text style={[styles.pageKicker, { color: currentPage.color }]}>
                    Step {page + 1} of {guidePages.length}
                  </Text>
                  <Text style={styles.pageTitle}>{currentPage.title}</Text>
                </View>
              </View>
              <Text style={styles.pageBody}>{currentPage.body}</Text>
            </View>

            <View style={styles.pointPanel}>
              {currentPage.points.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={[styles.pointDot, { backgroundColor: currentPage.color }]} />
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actionStrip}>
              <Button mode="contained" icon={currentPage.actionIcon} onPress={() => openAction(currentPage.action)}>
                {currentPage.actionLabel}
              </Button>
              <View style={styles.navActions}>
                <Button mode="outlined" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))}>
                  Back
                </Button>
                <Button
                  mode="contained-tonal"
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
          </AppCard>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    gap: 16
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontFamily: "Outfit_700Bold",
    maxWidth: 720
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
  guideLayout: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14
  },
  guideLayoutStacked: {
    flexDirection: "column"
  },
  sideRail: {
    width: 310,
    gap: 12
  },
  sideRailMobile: {
    width: "100%"
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
  progressCaption: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  progressCount: {
    color: palette.info,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  checkList: {
    gap: 7
  },
  checkItem: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 9,
    paddingVertical: 8
  },
  checkTitle: {
    color: palette.text,
    fontSize: 13,
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
  stepRail: {
    gap: 9
  },
  stepRailItem: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.025)",
    paddingHorizontal: 9,
    paddingVertical: 8
  },
  stepRailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  stepRailTitle: {
    color: palette.muted,
    fontSize: 13,
    fontFamily: "Outfit_700Bold"
  },
  stepRailSubtitle: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 14
  },
  pageCard: {
    flex: 1,
    minHeight: 430,
    justifyContent: "space-between",
    gap: 18,
    padding: 22
  },
  pageChrome: {
    gap: 14
  },
  pageTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  pageIcon: {
    width: 58,
    height: 58,
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
    fontSize: 32,
    lineHeight: 37,
    fontFamily: "Outfit_700Bold"
  },
  pageBody: {
    color: palette.muted,
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 720
  },
  pointPanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 14
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
    fontSize: 15,
    lineHeight: 22
  },
  actionStrip: {
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
    flexWrap: "wrap",
    gap: 8
  }
});
