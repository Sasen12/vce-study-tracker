import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { Link, router } from "expo-router";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { VCE_SUBJECTS, VCE_SUBJECT_CATEGORIES } from "@/constants/vceSubjects";
import { palette, subjectColors } from "@/constants/theme";
import { freePlan } from "@/constants/pricing";
import { useAuthStore } from "@/store/authStore";

type SelectedSubject = {
  subjectName: string;
  unit: "1/2" | "3/4";
  color: string;
  targetScore?: number | null;
};

const maxSubjects = freePlan.limits.maxSubjects;

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [selected, setSelected] = useState<SelectedSubject[]>([]);
  const register = useAuthStore((state) => state.register);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const subjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    return VCE_SUBJECTS.filter(
      (subject) =>
        !query || subject.name.toLowerCase().includes(query) || subject.category.toLowerCase().includes(query)
    );
  }, [subjectSearch]);
  const groupedSubjects = useMemo(
    () =>
      VCE_SUBJECT_CATEGORIES.map((category) => ({
        category,
        subjects: subjects.filter((subject) => subject.category === category)
      })).filter((group) => group.subjects.length),
    [subjects]
  );

  const toggleSubject = (subjectName: string) => {
    setSelected((current) => {
      if (current.some((subject) => subject.subjectName === subjectName)) {
        return current.filter((subject) => subject.subjectName !== subjectName);
      }
      if (current.length >= maxSubjects) return current;
      const source = VCE_SUBJECTS.find((subject) => subject.name === subjectName);
      return [
        ...current,
        {
          subjectName,
          unit: source?.units.includes("3/4") ? "3/4" : "1/2",
          color: subjectColors[current.length % subjectColors.length],
          targetScore: null
        }
      ];
    });
  };

  const updateUnit = (subjectName: string, unit: "1/2" | "3/4") => {
    setSelected((current) =>
      current.map((subject) => (subject.subjectName === subjectName ? { ...subject, unit } : subject))
    );
  };

  const updateTarget = (subjectName: string, value: string) => {
    const score = Number(value);
    setSelected((current) =>
      current.map((subject) =>
        subject.subjectName === subjectName
          ? { ...subject, targetScore: Number.isFinite(score) && value ? score : null }
          : subject
      )
    );
  };

  const submit = async () => {
    try {
      await register({ displayName, email, password, subjects: selected });
      router.replace("/(tabs)");
    } catch {
      // The auth store surfaces the message inline.
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <View>
          <Text variant="headlineLarge" style={styles.title}>
            Build your VCE stack
          </Text>
          <Text style={styles.subtitle}>
            Pick up to {maxSubjects} subjects on Free. You can unlock the full 8-subject VCE stack after upgrading.
          </Text>
        </View>

        <AppCard style={styles.form}>
          <TextInput mode="outlined" label="Display name" value={displayName} onChangeText={setDisplayName} />
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            secureTextEntry
            onChangeText={setPassword}
          />
        </AppCard>

        <AppCard style={styles.subjectCard}>
          <View style={styles.subjectHeader}>
            <View>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Subjects
              </Text>
              <Text style={styles.subjectHint}>Search the VCE list. Students can add and remove subjects later.</Text>
            </View>
            <Text style={styles.selectedCount}>{selected.length}/{maxSubjects} selected</Text>
          </View>
          <TextInput
            mode="outlined"
            dense
            label="Search subjects"
            value={subjectSearch}
            onChangeText={setSubjectSearch}
            left={<TextInput.Icon icon="magnify" />}
          />

          {groupedSubjects.map((group) => (
            <View key={group.category} style={styles.subjectGroup}>
              <Text style={styles.categoryLabel}>{group.category}</Text>
              <View style={styles.subjectGrid}>
                {group.subjects.map((subject) => {
                  const active = selected.some((item) => item.subjectName === subject.name);
                  const locked = !active && selected.length >= maxSubjects;
                  return (
                    <Pressable
                      key={subject.name}
                      onPress={() => toggleSubject(subject.name)}
                      disabled={locked}
                      style={[styles.subjectChip, active && styles.activeSubject, locked && styles.lockedSubject]}
                    >
                      <Text style={[styles.subjectText, active && styles.activeSubjectText]} numberOfLines={2}>
                        {subject.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {selected.map((subject) => (
            <View key={subject.subjectName} style={styles.targetRow}>
              <View style={[styles.dot, { backgroundColor: subject.color }]} />
              <Text style={styles.targetName} numberOfLines={1}>
                {subject.subjectName}
              </Text>
              <SegmentedButtons
                value={subject.unit}
                onValueChange={(value) => updateUnit(subject.subjectName, value as "1/2" | "3/4")}
                buttons={(VCE_SUBJECTS.find((item) => item.name === subject.subjectName)?.units ?? ["3/4"]).map((unit) => ({
                  value: unit,
                  label: unit
                }))}
                style={styles.unitButtons}
              />
              <TextInput
                mode="outlined"
                dense
                label="Target"
                keyboardType="number-pad"
                value={subject.targetScore?.toString() ?? ""}
                onChangeText={(value) => updateTarget(subject.subjectName, value)}
                style={styles.targetInput}
              />
            </View>
          ))}
        </AppCard>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          mode="contained"
          icon="account-plus"
          loading={loading}
          disabled={loading || selected.length === 0}
          onPress={submit}
        >
          Start tracking
        </Button>
        <Link href="/(auth)/login" style={styles.link}>
          Already have an account?
        </Link>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  subtitle: {
    color: palette.muted,
    lineHeight: 21
  },
  form: {
    gap: 12
  },
  subjectCard: {
    gap: 12
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  subjectHint: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  selectedCount: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  subjectGroup: {
    gap: 8
  },
  categoryLabel: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    textTransform: "uppercase"
  },
  subjectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  subjectChip: {
    width: 150,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  activeSubject: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}22`
  },
  lockedSubject: {
    opacity: 0.4
  },
  subjectText: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  activeSubjectText: {
    color: palette.text
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  targetName: {
    flex: 1,
    color: palette.text
  },
  unitButtons: {
    width: 126
  },
  targetInput: {
    width: 92
  },
  error: {
    color: palette.secondary
  },
  link: {
    color: palette.primary,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
