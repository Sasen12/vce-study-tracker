import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, SegmentedButtons, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { BADGE_SHOP_ITEMS, DEFAULT_TITLE_ID, STARTER_TITLE_IDS, TITLE_SHOP_ITEMS } from "@/constants/gamification";
import { palette, themeShopItems } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import { useTrackScreen } from "@/hooks/useTrackScreen";

type ShopMode = "themes" | "titles" | "badges";

export default function ShopScreen() {
  useTrackScreen("shop");
  const { gamification, loading, fetchAll, unlockTheme, applyTheme, unlockTitle, applyTitle, unlockBadge } = useAppStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [mode, setMode] = useState<ShopMode>("themes");

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const xpBalance = gamification?.xpBalance ?? 0;
  const activeTheme = gamification?.activeTheme ?? "midnight";
  const activeTitle = gamification?.activeTitle ?? DEFAULT_TITLE_ID;
  const unlocked = useMemo(
    () => new Set(["midnight", ...STARTER_TITLE_IDS.map((titleId) => `title:${titleId}`), ...(gamification?.unlockedCosmetics ?? [])]),
    [gamification?.unlockedCosmetics]
  );
  const badges = useMemo(() => new Set(gamification?.badges ?? []), [gamification?.badges]);
  const unlockedCount = themeShopItems.filter((theme) => unlocked.has(theme.id)).length;
  const titleCount = TITLE_SHOP_ITEMS.filter((title) => unlocked.has(`title:${title.id}`)).length;
  const badgeCount = BADGE_SHOP_ITEMS.filter((badge) => badges.has(badge.id)).length;
  const entryPrice = useMemo(() => {
    const prices =
      mode === "themes"
        ? themeShopItems.map((item) => item.price)
        : mode === "titles"
          ? TITLE_SHOP_ITEMS.map((item) => item.price)
          : BADGE_SHOP_ITEMS.map((item) => item.price);
    return Math.min(...prices.filter((price) => price > 0));
  }, [mode]);

  const chooseTheme = async (themeId: string, isUnlocked: boolean) => {
    setBusyId(themeId);
    setShopError(null);
    try {
      if (isUnlocked) {
        await applyTheme(themeId);
      } else {
        await unlockTheme(themeId);
      }
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Could not update theme");
    } finally {
      setBusyId(null);
    }
  };

  const chooseTitle = async (titleId: string, isUnlocked: boolean) => {
    setBusyId(`title:${titleId}`);
    setShopError(null);
    try {
      if (isUnlocked) {
        await applyTitle(titleId);
      } else {
        await unlockTitle(titleId);
      }
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Could not update title");
    } finally {
      setBusyId(null);
    }
  };

  const chooseBadge = async (badgeId: string) => {
    setBusyId(`badge:${badgeId}`);
    setShopError(null);
    try {
      await unlockBadge(badgeId);
    } catch (error) {
      setShopError(error instanceof Error ? error.message : "Could not unlock badge");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !gamification) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Coin shop</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Shop
          </Text>
        </View>
        <View style={styles.coinPill}>
          <Text style={styles.coinValue}>{xpBalance}</Text>
          <Text style={styles.coinLabel}>coins</Text>
        </View>
      </View>

      <AppCard style={styles.proWaitlistCard}>
        <View style={styles.summaryTop}>
          <View style={styles.proWaitlistIcon}>
            <MaterialCommunityIcons name="star-four-points-outline" color={palette.warning} size={24} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>VCE Study Tracker Pro</Text>
            <Text style={styles.muted}>Coming soon. Join the waitlist to test interest before payments exist.</Text>
          </View>
        </View>
        <Button mode="contained" icon="email-plus-outline" onPress={() => router.push("/(tabs)/pro")}>
          View Pro
        </Button>
      </AppCard>

      <AppCard style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryIcon}>
            <MaterialCommunityIcons
              name={mode === "themes" ? "palette-swatch-outline" : mode === "titles" ? "tag-text-outline" : "medal-outline"}
              color={palette.primary}
              size={24}
            />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>
              {mode === "themes" ? "Theme unlocks" : mode === "titles" ? "Profile titles" : "Collectible badges"}
            </Text>
            <Text style={styles.muted}>
              {mode === "themes"
                ? `${unlockedCount}/${themeShopItems.length} unlocked`
                : mode === "titles"
                  ? `${titleCount}/${TITLE_SHOP_ITEMS.length} unlocked`
                  : `${badgeCount}/${BADGE_SHOP_ITEMS.length} collected`}
            </Text>
            <Text style={styles.muted}>Starter picks from {entryPrice} coins.</Text>
          </View>
        </View>
      </AppCard>

      <SegmentedButtons
        value={mode}
        onValueChange={(value) => setMode(value as ShopMode)}
        buttons={[
          { value: "themes", label: "Themes", icon: "palette-outline" },
          { value: "titles", label: "Titles", icon: "tag-text-outline" },
          { value: "badges", label: "Badges", icon: "medal-outline" }
        ]}
      />

      {mode === "themes" ? (
        <View style={styles.themeGrid}>
        {themeShopItems.map((theme) => {
          const isUnlocked = unlocked.has(theme.id);
          const isActive = activeTheme === theme.id;
          const canAfford = xpBalance >= theme.price;
          const loadingTheme = busyId === theme.id;
          const actionLabel = isActive
            ? "Equipped"
            : isUnlocked
              ? "Use"
              : canAfford
                ? "Unlock"
                : `${theme.price - xpBalance} more`;

          return (
            <View
              key={theme.id}
              style={[
                styles.themeItem,
                {
                  borderColor: isActive ? theme.colors.primary : palette.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            >
              <View style={[styles.themePreview, { backgroundColor: theme.colors.background }]}>
                <View style={[styles.themePreviewCard, { backgroundColor: theme.colors.surfaceRaised }]}>
                  <View style={[styles.themePreviewLine, { backgroundColor: theme.colors.primary }]} />
                  <View style={[styles.themePreviewLineShort, { backgroundColor: theme.colors.secondary }]} />
                </View>
              </View>
              <View style={styles.themeTextRow}>
                <View style={styles.themeNameRow}>
                  <Text style={[styles.themeName, { color: theme.colors.text }]}>{theme.name}</Text>
                  {theme.motion ? (
                    <MaterialCommunityIcons name="motion-play-outline" color={theme.colors.primary} size={16} />
                  ) : null}
                </View>
                <Text style={[styles.themePrice, { color: theme.colors.muted }]}>
                  {theme.price ? `${theme.price} coins` : "Starter"}
                </Text>
              </View>
              <Button
                mode={isActive ? "outlined" : "contained"}
                compact
                loading={loadingTheme}
                disabled={loadingTheme || isActive || (!isUnlocked && !canAfford)}
                buttonColor={isActive ? undefined : theme.colors.primary}
                textColor={isActive ? theme.colors.primary : theme.colors.background}
                icon={isUnlocked ? "palette-outline" : "lock-open-outline"}
                onPress={() => chooseTheme(theme.id, isUnlocked)}
              >
                {actionLabel}
              </Button>
            </View>
          );
        })}
        </View>
      ) : null}

      {mode === "titles" ? (
        <View style={styles.itemList}>
          {TITLE_SHOP_ITEMS.map((title) => {
            const isUnlocked = unlocked.has(`title:${title.id}`);
            const isActive = activeTitle === title.id;
            const canAfford = xpBalance >= title.price;
            const loadingTitle = busyId === `title:${title.id}`;
            const actionLabel = isActive
              ? "Equipped"
              : isUnlocked
                ? "Use"
                : canAfford
                  ? "Unlock"
                  : `${title.price - xpBalance} more`;

            return (
              <AppCard key={title.id} style={[styles.shopItemCard, isActive && styles.shopItemCardActive]}>
                <View style={styles.shopItemTop}>
                  <View style={styles.shopItemIcon}>
                    <MaterialCommunityIcons name="tag-text-outline" color={palette.primary} size={22} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.shopItemTitle}>{title.label}</Text>
                    <Text style={styles.muted}>{title.description}</Text>
                    <Text style={styles.themePrice}>{title.price ? `${title.price} coins` : "Starter"}</Text>
                  </View>
                </View>
                <Button
                  mode={isActive ? "outlined" : "contained"}
                  compact
                  loading={loadingTitle}
                  disabled={loadingTitle || isActive || (!isUnlocked && !canAfford)}
                  icon={isUnlocked ? "tag-outline" : "lock-open-outline"}
                  onPress={() => chooseTitle(title.id, isUnlocked)}
                >
                  {actionLabel}
                </Button>
              </AppCard>
            );
          })}
        </View>
      ) : null}

      {mode === "badges" ? (
        <View style={styles.itemList}>
          {BADGE_SHOP_ITEMS.map((badge) => {
            const isUnlocked = badges.has(badge.id);
            const canAfford = xpBalance >= badge.price;
            const loadingBadge = busyId === `badge:${badge.id}`;
            const actionLabel = isUnlocked ? "Collected" : canAfford ? "Unlock" : `${badge.price - xpBalance} more`;

            return (
              <AppCard key={badge.id} style={[styles.shopItemCard, isUnlocked && styles.shopItemCardActive]}>
                <View style={styles.shopItemTop}>
                  <View style={styles.shopItemIcon}>
                    <MaterialCommunityIcons name={isUnlocked ? "medal" : "medal-outline"} color={palette.warning} size={22} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.shopItemTitle}>{badge.label}</Text>
                    <Text style={styles.muted}>{badge.description}</Text>
                    <Text style={styles.themePrice}>{badge.price} coins</Text>
                  </View>
                </View>
                <Button
                  mode={isUnlocked ? "outlined" : "contained"}
                  compact
                  loading={loadingBadge}
                  disabled={loadingBadge || isUnlocked || !canAfford}
                  icon={isUnlocked ? "check" : "lock-open-outline"}
                  onPress={() => chooseBadge(badge.id)}
                >
                  {actionLabel}
                </Button>
              </AppCard>
            );
          })}
        </View>
      ) : null}

      {shopError ? <Text style={styles.errorText}>{shopError}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
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
  coinPill: {
    minWidth: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}18`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center"
  },
  coinValue: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "Outfit_700Bold"
  },
  coinLabel: {
    color: palette.muted,
    fontSize: 11
  },
  summaryCard: {
    gap: 12
  },
  proWaitlistCard: {
    gap: 12,
    borderColor: `${palette.warning}44`,
    backgroundColor: `${palette.warning}10`
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  proWaitlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.warning}18`
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}18`
  },
  flexText: {
    flex: 1,
    minWidth: 0
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
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  themeItem: {
    width: "48%",
    minWidth: 148,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 10
  },
  themePreview: {
    height: 82,
    borderRadius: 8,
    padding: 10,
    justifyContent: "flex-end"
  },
  themePreviewCard: {
    borderRadius: 6,
    padding: 8,
    gap: 6
  },
  themePreviewLine: {
    width: "72%",
    height: 8,
    borderRadius: 8
  },
  themePreviewLineShort: {
    width: "46%",
    height: 8,
    borderRadius: 8
  },
  themeTextRow: {
    gap: 2
  },
  themeNameRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  themeName: {
    flexShrink: 1,
    fontFamily: "Outfit_700Bold"
  },
  themePrice: {
    color: palette.muted,
    fontSize: 12
  },
  itemList: {
    gap: 10
  },
  shopItemCard: {
    gap: 12
  },
  shopItemCardActive: {
    borderColor: `${palette.primary}66`,
    backgroundColor: `${palette.primary}10`
  },
  shopItemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  shopItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.primary}18`
  },
  shopItemTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  errorText: {
    color: palette.secondary,
    lineHeight: 18
  }
});
