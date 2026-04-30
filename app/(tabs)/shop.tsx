import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { palette, themeShopItems } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";

export default function ShopScreen() {
  const { gamification, loading, fetchAll, unlockTheme, applyTheme } = useAppStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const xpBalance = gamification?.xpBalance ?? 0;
  const activeTheme = gamification?.activeTheme ?? "midnight";
  const unlocked = useMemo(
    () => new Set(["midnight", ...(gamification?.unlockedCosmetics ?? [])]),
    [gamification?.unlockedCosmetics]
  );
  const unlockedCount = themeShopItems.filter((theme) => unlocked.has(theme.id)).length;

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

      <AppCard style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryIcon}>
            <MaterialCommunityIcons name="palette-swatch-outline" color={palette.primary} size={24} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.cardTitle}>Theme unlocks</Text>
            <Text style={styles.muted}>
              {unlockedCount}/{themeShopItems.length} unlocked
            </Text>
          </View>
        </View>
      </AppCard>

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
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
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
    fontSize: 12
  },
  errorText: {
    color: palette.secondary,
    lineHeight: 18
  }
});
