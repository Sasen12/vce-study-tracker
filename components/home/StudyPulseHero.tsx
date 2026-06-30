import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { motion } from "@/constants/motion";
import { useActivePalette } from "@/hooks/useActiveTheme";

type PulseSession = {
  createdAt: string;
  durationSeconds: number;
};

type StudyPulseHeroProps = {
  displayName?: string | null;
  dateLabel: string;
  todaySeconds: number;
  weekSeconds: number;
  sessions: PulseSession[];
  nextDeadlineTitle?: string | null;
  nextDeadlineLabel?: string | null;
  nextDeadlineDays?: number | null;
  actions?: ReactNode;
  onPressPulse?: () => void;
};

const PULSE_DAYS = 14;
const BAR_MAX = 34;
const BAR_MIN = 6;
const NUB = 3;

const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const formatStudy = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
};

export function StudyPulseHero({
  displayName,
  dateLabel,
  todaySeconds,
  weekSeconds,
  sessions,
  nextDeadlineTitle,
  nextDeadlineLabel,
  nextDeadlineDays,
  actions,
  onPressPulse
}: StudyPulseHeroProps) {
  const palette = useActivePalette();
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(0.6);

  const pulse = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: PULSE_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (PULSE_DAYS - 1 - index));
      return { date, minutes: 0 };
    });
    const startMs = days[0].date.getTime();
    sessions.forEach((session) => {
      const day = startOfDay(new Date(session.createdAt)).getTime();
      const index = Math.round((day - startMs) / 86400000);
      if (index >= 0 && index < PULSE_DAYS) {
        days[index].minutes += Math.max(0, Math.round(session.durationSeconds / 60));
      }
    });
    return days;
  }, [sessions]);

  const peak = useMemo(() => Math.max(90, ...pulse.map((day) => day.minutes)), [pulse]);
  const studiedToday = todaySeconds > 0;
  const activeDays = useMemo(() => pulse.filter((day) => day.minutes > 0).length, [pulse]);
  const firstName = (displayName ?? "there").trim().split(" ")[0] || "there";

  useEffect(() => {
    if (studiedToday && !reduceMotion) {
      glow.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
    } else {
      cancelAnimation(glow);
      glow.value = studiedToday ? 0.9 : 0.35;
    }
    return () => cancelAnimation(glow);
  }, [glow, reduceMotion, studiedToday]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const deadlineTone =
    nextDeadlineDays == null
      ? palette.muted
      : nextDeadlineDays <= 2
        ? palette.secondary
        : nextDeadlineDays <= 7
          ? palette.warning
          : palette.info;

  const pulseAccessibilityLabel = `Study pulse: ${formatStudy(todaySeconds)} today, ${formatStudy(
    weekSeconds
  )} this week, ${activeDays} of the last ${PULSE_DAYS} days studied.`;

  return (
    <Animated.View entering={motion.card(0)}>
      <View style={[styles.hero, { borderColor: `${palette.primary}33`, backgroundColor: palette.surfaceRaised }]}>
        <LinearGradient
          colors={[`${palette.primary}26`, `${palette.surfaceRaised}00`, `${palette.surface}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.topRow}>
          <View style={styles.identity}>
            <Text style={[styles.eyebrow, { color: palette.muted }]} numberOfLines={1}>
              {dateLabel.toUpperCase()}
            </Text>
            <Text style={[styles.greeting, { color: palette.text }]} numberOfLines={1}>
              {getTimeGreeting()}, {firstName}
            </Text>
            <View style={styles.thesisRow}>
              {nextDeadlineTitle ? (
                <>
                  <Text style={[styles.thesis, { color: palette.muted }]} numberOfLines={1}>
                    {nextDeadlineTitle}
                  </Text>
                  <View style={[styles.thesisDot, { backgroundColor: deadlineTone }]} />
                  <Text style={[styles.thesisStat, { color: deadlineTone }]} numberOfLines={1}>
                    {nextDeadlineLabel}
                  </Text>
                </>
              ) : (
                <Text style={[styles.thesis, { color: palette.muted }]} numberOfLines={1}>
                  No deadlines logged — you set the pace.
                </Text>
              )}
            </View>
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>

        <View style={styles.pulseBlock}>
          <View style={styles.pulseHeader}>
            <Text style={[styles.pulseLabel, { color: palette.muted }]}>FORTNIGHT PULSE</Text>
            <Text style={[styles.pulseStat, { color: palette.text }]} numberOfLines={1}>
              <Text style={{ color: palette.success, fontFamily: "Outfit_700Bold" }}>{formatStudy(todaySeconds)}</Text>
              {`  today · ${formatStudy(weekSeconds)} this week`}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pulseAccessibilityLabel}
            accessibilityHint="Opens insights"
            onPress={onPressPulse}
            style={styles.bars}
          >
            {pulse.map((day, index) => {
              const isToday = index === PULSE_DAYS - 1;
              const ratio = Math.min(1, day.minutes / peak);
              const height = day.minutes > 0 ? Math.round(BAR_MIN + ratio * (BAR_MAX - BAR_MIN)) : NUB;

              if (isToday) {
                return (
                  <View key={index} style={styles.todayColumn}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.todayGlow,
                        { backgroundColor: palette.primary, height: Math.max(height + 10, 18) },
                        glowStyle
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.todayBar,
                        {
                          height: studiedToday ? Math.max(height, BAR_MIN) : BAR_MIN,
                          backgroundColor: studiedToday ? palette.primary : "transparent",
                          borderColor: palette.primary
                        }
                      ]}
                    />
                  </View>
                );
              }

              if (day.minutes <= 0) {
                return <View key={index} style={[styles.bar, styles.nub, { backgroundColor: `${palette.muted}40` }]} />;
              }

              return (
                <View
                  key={index}
                  style={[styles.bar, { height, backgroundColor: palette.primary, opacity: 0.32 + ratio * 0.55 }]}
                />
              );
            })}
          </Pressable>

          <View style={[styles.baseline, { backgroundColor: palette.border }]} />
          <View style={styles.axis}>
            <Text style={[styles.axisLabel, { color: palette.muted }]}>14 days</Text>
            <Text style={[styles.axisLabel, { color: palette.muted }]}>today</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    overflow: "hidden",
    gap: 18
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Outfit_400Regular",
    letterSpacing: 2
  },
  greeting: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Outfit_700Bold",
    letterSpacing: -0.4
  },
  thesisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2
  },
  thesis: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: "Outfit_400Regular"
  },
  thesisDot: {
    width: 3,
    height: 3,
    borderRadius: 2
  },
  thesisStat: {
    fontSize: 13,
    fontFamily: "Outfit_700Bold"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10
  },
  pulseBlock: {
    gap: 8
  },
  pulseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  pulseLabel: {
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    letterSpacing: 2
  },
  pulseStat: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: "Outfit_400Regular"
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: BAR_MAX,
    gap: 4
  },
  bar: {
    flex: 1,
    borderRadius: 3
  },
  nub: {
    height: NUB,
    alignSelf: "flex-end"
  },
  todayColumn: {
    flex: 1,
    height: BAR_MAX,
    justifyContent: "flex-end",
    alignItems: "stretch"
  },
  todayGlow: {
    position: "absolute",
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 6
  },
  todayBar: {
    borderRadius: 3,
    borderWidth: 1.5
  },
  baseline: {
    height: 1,
    borderRadius: 1
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: "Outfit_400Regular",
    letterSpacing: 1
  }
});
