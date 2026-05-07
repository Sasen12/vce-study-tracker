import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { PRO_PLAN_VISIBLE } from "@/constants/proPlan";
import { palette } from "@/constants/theme";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import { studyApi } from "@/services/studyApi";
import { useAuthStore } from "@/store/authStore";

type Audience = "student" | "parent" | "tutor";
type PriceIntent = "term" | "monthly" | "yearly" | "not_now";

type Feature = {
  title: string;
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const freeFeatures: Feature[] = [
  { title: "Subject tracking", body: "Subjects, goals, tasks and calendar sessions stay in the free app.", icon: "book-open-page-variant-outline" },
  { title: "Core study tools", body: "Basic notes, XP, saved questions and the dashboard remain open.", icon: "checkbox-marked-circle-outline" },
  { title: "Founding students", body: "Current early users stay free through 2026 while Pro is tested.", icon: "shield-check-outline" }
];

const proFeatures: Feature[] = [
  { title: "AI weekly study plan", body: "A plan that reacts to deadlines, weak areas and available time.", icon: "robot-outline" },
  { title: "SAC and exam planner", body: "Countdowns that turn each assessment into daily revision moves.", icon: "calendar-star" },
  { title: "Advanced analytics", body: "Progress trends, weak area tracking and exportable study reports.", icon: "chart-line" },
  { title: "Power tools", body: "Custom themes, private leaderboards and future tutor booking tools.", icon: "star-four-points-outline" }
];

const tutorFeatures: Feature[] = [
  { title: "Tutor mode", body: "Manage students, set homework and review progress from one place.", icon: "account-tie-outline" },
  { title: "Session tools", body: "Booking notes, homework follow-up and priority session planning later.", icon: "clipboard-clock-outline" }
];

const priceOptions: { id: PriceIntent; price: string; cadence: string; note: string }[] = [
  { id: "term", price: "A$14.99", cadence: "per term", note: "Best VCE fit" },
  { id: "monthly", price: "A$2.99", cadence: "per month", note: "Tiny monthly test" },
  { id: "yearly", price: "A$24.99", cadence: "per year", note: "Best value" },
  { id: "not_now", price: "Free", cadence: "for now", note: "Interested later" }
];

const audienceLabels: Record<Audience, string> = {
  student: "Student",
  parent: "Parent",
  tutor: "Tutor"
};

function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <MaterialCommunityIcons name={feature.icon} color={palette.primary} size={20} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.muted}>{feature.body}</Text>
      </View>
    </View>
  );
}

export default function ProScreen() {
  useTrackScreen("pro");
  const user = useAuthStore((state) => state.user);
  const [audience, setAudience] = useState<Audience>("student");
  const [priceIntent, setPriceIntent] = useState<PriceIntent>("term");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPrice = useMemo(() => priceOptions.find((option) => option.id === priceIntent) ?? priceOptions[0], [priceIntent]);

  const joinWaitlist = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await studyApi.sendFeedback({
        category: "feature",
        message: [
          "PRO_WAITLIST",
          `Audience: ${audienceLabels[audience]}`,
          `Selected price: ${selectedPrice.price} ${selectedPrice.cadence}`,
          `Contact: ${contactEmail.trim() || user?.email || "account email"}`,
          "No payment requested."
        ].join("\n")
      });
      setMessage("Saved. No payment has been taken, and your Pro interest is logged.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your waitlist response.");
    } finally {
      setSaving(false);
    }
  };

  if (!PRO_PLAN_VISIBLE) {
    return <Redirect href="/(tabs)/shop" />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Coming soon</Text>
        <Text variant="headlineLarge" style={styles.title}>
          VCE Study Tracker Pro
        </Text>
        <Text style={styles.lede}>
          The free app stays alive. Pro is for the students, parents and tutors who want deeper planning without surprise charges.
        </Text>
      </View>

      <AppCard style={styles.foundingCard}>
        <View style={styles.cardTop}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="gift-outline" color={palette.success} size={22} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>Founding user promise</Text>
            <Text style={styles.muted}>Core tracking, tasks, notes, XP, calendar sessions and dashboards stay free.</Text>
          </View>
        </View>
      </AppCard>

      <View style={styles.planGrid}>
        <AppCard style={styles.planCard}>
          <Text style={styles.cardTitle}>Free</Text>
          <Text style={styles.planPrice}>A$0</Text>
          <Text style={styles.muted}>For normal student tracking.</Text>
          <View style={styles.featureList}>
            {freeFeatures.map((feature) => (
              <FeatureRow key={feature.title} feature={feature} />
            ))}
          </View>
        </AppCard>

        <AppCard style={styles.proCard}>
          <View style={styles.proBadge}>
            <MaterialCommunityIcons name="star-four-points-outline" color={palette.warning} size={16} />
            <Text style={styles.proBadgeText}>Waitlist test</Text>
          </View>
          <Text style={styles.cardTitle}>Student Pro</Text>
          <Text style={styles.planPrice}>A$14.99</Text>
          <Text style={styles.muted}>Per school term is the price worth testing first.</Text>
          <View style={styles.featureList}>
            {proFeatures.map((feature) => (
              <FeatureRow key={feature.title} feature={feature} />
            ))}
          </View>
        </AppCard>
      </View>

      <AppCard style={styles.tutorCard}>
        <View style={styles.cardTop}>
          <View style={styles.tutorIcon}>
            <MaterialCommunityIcons name="school-outline" color={palette.info} size={22} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>Tutor plan later</Text>
            <Text style={styles.muted}>Likely A$9.99-A$19.99/month once multi-student tools are ready.</Text>
          </View>
        </View>
        <View style={styles.featureList}>
          {tutorFeatures.map((feature) => (
            <FeatureRow key={feature.title} feature={feature} />
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.waitlistCard}>
        <View>
          <Text style={styles.cardTitle}>Join Pro waitlist</Text>
          <Text style={styles.muted}>This only records interest. There is no subscription, free trial or charge today.</Text>
        </View>

        <SegmentedButtons
          value={audience}
          onValueChange={(value) => setAudience(value as Audience)}
          buttons={[
            { value: "student", label: "Student", icon: "account-school-outline" },
            { value: "parent", label: "Parent", icon: "account-heart-outline" },
            { value: "tutor", label: "Tutor", icon: "account-tie-outline" }
          ]}
        />

        <View style={styles.priceGrid}>
          {priceOptions.map((option) => {
            const selected = option.id === priceIntent;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPriceIntent(option.id)}
                style={[styles.priceOption, selected && styles.priceOptionSelected]}
              >
                <Text style={styles.priceText}>{option.price}</Text>
                <Text style={styles.priceCadence}>{option.cadence}</Text>
                <Text style={styles.priceNote}>{option.note}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          mode="outlined"
          label="Best contact email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={contactEmail}
          onChangeText={setContactEmail}
          left={<TextInput.Icon icon="email-outline" />}
        />

        {message ? <Text style={message.includes("Saved") ? styles.successText : styles.errorText}>{message}</Text> : null}

        <Button mode="contained" icon="email-plus-outline" loading={saving} disabled={saving} onPress={joinWaitlist}>
          Join waitlist
        </Button>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold"
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  lede: {
    color: palette.muted,
    lineHeight: 21
  },
  foundingCard: {
    borderColor: `${palette.success}44`,
    backgroundColor: `${palette.success}10`
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.success}18`
  },
  planGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  planCard: {
    flex: 1,
    minWidth: 250,
    gap: 12
  },
  proCard: {
    flex: 1,
    minWidth: 250,
    gap: 12,
    borderColor: `${palette.warning}44`,
    backgroundColor: `${palette.warning}10`
  },
  proBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.warning}55`,
    backgroundColor: `${palette.warning}18`,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  proBadgeText: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  planPrice: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 34,
    lineHeight: 40
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  flexText: {
    flex: 1,
    minWidth: 0
  },
  featureList: {
    gap: 10
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}18`
  },
  featureTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  tutorCard: {
    gap: 12,
    borderColor: `${palette.info}44`,
    backgroundColor: `${palette.info}10`
  },
  tutorIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.info}18`
  },
  waitlistCard: {
    gap: 14
  },
  priceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  priceOption: {
    flex: 1,
    minWidth: 132,
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 12,
    justifyContent: "center"
  },
  priceOptionSelected: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}18`
  },
  priceText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    lineHeight: 27
  },
  priceCadence: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  priceNote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  successText: {
    color: palette.success,
    fontFamily: "Outfit_700Bold",
    lineHeight: 20
  },
  errorText: {
    color: palette.secondary,
    lineHeight: 20
  }
});
