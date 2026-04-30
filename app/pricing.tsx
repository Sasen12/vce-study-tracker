import { useCallback, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { pricingPlans } from "@/constants/pricing";
import { palette } from "@/constants/theme";
import { studyApi } from "@/services/studyApi";
import { useAppStore } from "@/store/appStore";
import type { BillingPlanId } from "@/types";

const currentReturnUrl = () => {
  if (Platform.OS !== "web") return undefined;
  const location = (globalThis as typeof globalThis & { location?: { origin?: string } }).location;
  return location?.origin ? `${location.origin}/pricing` : undefined;
};

const openExternalUrl = async (url: string) => {
  if (Platform.OS === "web") {
    const location = (globalThis as typeof globalThis & { location?: { href?: string } }).location;
    if (location) {
      location.href = url;
      return;
    }
  }
  await Linking.openURL(url);
};

export default function PricingScreen() {
  const { billing, billingUsage, loading, fetchAll, refreshBilling } = useAppStore();
  const [busyPlan, setBusyPlan] = useState<BillingPlanId | "portal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!billing) {
        fetchAll();
        return;
      }
      refreshBilling();
    }, [billing, fetchAll, refreshBilling])
  );

  const activePlan = billing?.plan ?? "free";
  const hasStripeCustomer = Boolean(billing?.stripeCustomerId);

  const choosePlan = async (planId: BillingPlanId) => {
    setMessage(null);
    if (planId === "free" || planId === activePlan) return;

    setBusyPlan(planId);
    try {
      const data = await studyApi.createCheckout({ plan: planId, returnUrl: currentReturnUrl() });
      await openExternalUrl(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setBusyPlan(null);
    }
  };

  const manageBilling = async () => {
    setMessage(null);
    setBusyPlan("portal");
    try {
      const data = await studyApi.createBillingPortal({ returnUrl: currentReturnUrl() });
      await openExternalUrl(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open billing portal.");
    } finally {
      setBusyPlan(null);
    }
  };

  if (loading && !billing) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Button mode="outlined" icon="arrow-left" onPress={() => router.back()}>
          Back
        </Button>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Billing</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Pricing
          </Text>
        </View>
      </View>

      <AppCard style={styles.currentCard}>
        <View style={styles.currentTop}>
          <View style={styles.currentIcon}>
            <MaterialCommunityIcons name="credit-card-check-outline" color={palette.primary} size={24} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>Current plan: {billing?.currentPlan.name ?? "Free"}</Text>
            <Text style={styles.muted}>
              {billingUsage?.subjects ?? 0}/{billing?.limits.maxSubjects ?? 4} subjects, {billingUsage?.resources ?? 0}/
              {billing?.limits.maxResources ?? 5} files, {billing?.limits.aiActionsPerDay ?? 6} AI actions/day.
            </Text>
          </View>
          {hasStripeCustomer ? (
            <Button mode="outlined" loading={busyPlan === "portal"} disabled={busyPlan === "portal"} onPress={manageBilling}>
              Manage
            </Button>
          ) : null}
        </View>
      </AppCard>

      {message ? <Text style={styles.error}>{message}</Text> : null}

      <View style={styles.planGrid}>
        {pricingPlans.map((plan) => {
          const current = activePlan === plan.id;
          const paid = plan.id !== "free";
          const loadingPlan = busyPlan === plan.id;
          const buttonLabel = current ? "Current" : paid ? "Upgrade" : "Included";

          return (
            <AppCard key={plan.id} style={[styles.planCard, current && styles.planCardActive]}>
              <View style={styles.planTop}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                </View>
                {current ? (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>Active</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.muted}>{plan.summary}</Text>
              <View style={styles.featureList}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <MaterialCommunityIcons name="check-circle-outline" color={palette.success} size={17} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
              <Button
                mode={current ? "outlined" : "contained"}
                icon={paid ? "arrow-up-bold-circle-outline" : "check"}
                loading={loadingPlan}
                disabled={current || loadingPlan || plan.id === "free"}
                onPress={() => choosePlan(plan.id)}
              >
                {buttonLabel}
              </Button>
            </AppCard>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
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
  currentCard: {
    gap: 12
  },
  currentTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  currentIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}18`
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  error: {
    color: palette.secondary,
    lineHeight: 20
  },
  planGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  planCard: {
    width: "31%",
    minWidth: 245,
    flexGrow: 1,
    gap: 12
  },
  planCardActive: {
    borderColor: `${palette.primary}88`,
    backgroundColor: "rgba(124,110,255,0.08)"
  },
  planTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  planName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 22
  },
  planPrice: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    marginTop: 2
  },
  currentPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(74,222,128,0.14)",
    overflow: "hidden"
  },
  currentPillText: {
    color: palette.success,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  featureList: {
    gap: 8
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  featureText: {
    color: palette.text,
    flex: 1,
    lineHeight: 19
  }
});
