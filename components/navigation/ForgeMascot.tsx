import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";
import { useActivePalette } from "@/hooks/useActiveTheme";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import {
  DEFAULT_STUDY_PREFERENCES,
  loadStudyPreferences,
  subscribeStudyPreferences,
  type StudyPreferences
} from "@/utils/studyPreferences";
import type { StudyAnswer } from "@/types";

const POCKET_BIRD_SRC = "https://cdn.jsdelivr.net/gh/IdreesInc/Pocket-Bird@main/dist/web/birb.embed.js";
const POCKET_BIRD_SCRIPT_ID = "vce-forge-pocket-bird-script";
const POCKET_BIRD_HOST_ID = "birb-shadow-host";
const POCKET_BIRD_SAVE_KEY = "birbSaveData";
const POCKET_BIRD_ASK_ID = "vce-forge-pocket-bird-ask";
const POCKET_BIRD_ASK_SEPARATOR_ID = "vce-forge-pocket-bird-ask-separator";
const POCKET_BIRD_FLIGHT_TARGET_CLASS = "vce-pocket-bird-flight-target";
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const FLIGHT_TARGETS = [
  { left: "7%", top: "calc(100vh - 145px)", width: 220 },
  { left: "34%", top: "calc(100vh - 118px)", width: 260 },
  { left: "69%", top: "calc(100vh - 168px)", width: 220 },
  { left: "18%", top: "calc(100vh - 260px)", width: 190 },
  { left: "54%", top: "calc(100vh - 310px)", width: 240 },
  { left: "75%", top: "calc(100vh - 390px)", width: 180 },
  { left: "12%", top: "52%", width: 180 },
  { left: "47%", top: "44%", width: 230 },
  { left: "70%", top: "58%", width: 200 },
  { left: "22%", top: "30%", width: 190 }
];

type PocketBirdWindow = Window &
  typeof globalThis & {
    __vceForgePocketBirdLoaded?: boolean;
  };

const isWebDomAvailable = () => Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined";

const compactAnswer = (answer: StudyAnswer) =>
  [
    answer.answer,
    answer.key_points.length ? `Key points:\n${answer.key_points.map((point) => `- ${point}`).join("\n")}` : null,
    answer.follow_up_questions.length
      ? `Follow-up:\n${answer.follow_up_questions.map((question) => `- ${question}`).join("\n")}`
      : null
  ]
    .filter(Boolean)
    .join("\n\n");

const getPocketBirdHost = () => document.getElementById(POCKET_BIRD_HOST_ID) as HTMLElement | null;

const setPocketBirdVisible = (visible: boolean) => {
  if (!isWebDomAvailable()) return;
  const host = getPocketBirdHost();
  if (!host) return;
  host.style.display = visible ? "" : "none";
  host.style.pointerEvents = visible ? "" : "none";
  host.setAttribute("aria-hidden", visible ? "false" : "true");
};

const seedPocketBirdDefaults = () => {
  if (!isWebDomAvailable() || !("localStorage" in window)) return;

  try {
    const stored = window.localStorage.getItem(POCKET_BIRD_SAVE_KEY);
    const rawParsed = stored ? JSON.parse(stored) : {};
    const parsed = rawParsed && typeof rawParsed === "object" ? rawParsed : {};
    const settings = parsed && typeof parsed.settings === "object" && parsed.settings ? parsed.settings : {};
    const nextSettings = {
      soundEnabled: false,
      birbScaleMultiplier: 1.45,
      ...settings
    };

    if (!stored || settings.soundEnabled === undefined || settings.birbScaleMultiplier === undefined) {
      window.localStorage.setItem(
        POCKET_BIRD_SAVE_KEY,
        JSON.stringify({
          ...parsed,
          settings: nextSettings
        })
      );
    }
  } catch {
    // Pocket-Bird can still boot with its own defaults if local storage is unavailable.
  }
};

const ensurePocketBirdFlightTargets = () => {
  if (!isWebDomAvailable() || document.querySelector(`.${POCKET_BIRD_FLIGHT_TARGET_CLASS}`)) return;

  FLIGHT_TARGETS.forEach((target, index) => {
    const image = document.createElement("img");
    image.src = TRANSPARENT_PIXEL;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.className = POCKET_BIRD_FLIGHT_TARGET_CLASS;
    image.style.position = "fixed";
    image.style.left = target.left;
    image.style.top = target.top;
    image.style.width = `${target.width}px`;
    image.style.height = "1px";
    image.style.pointerEvents = "none";
    image.style.userSelect = "none";
    image.style.zIndex = "-1";
    image.dataset.vceForgeFlightTarget = String(index);
    document.body.appendChild(image);
  });
};

const removePocketBirdFlightTargets = () => {
  if (!isWebDomAvailable()) return;
  document.querySelectorAll(`.${POCKET_BIRD_FLIGHT_TARGET_CLASS}`).forEach((element) => element.remove());
};

const ensurePocketBirdScript = () => {
  if (!isWebDomAvailable()) return;
  const pocketWindow = window as PocketBirdWindow;
  seedPocketBirdDefaults();
  ensurePocketBirdFlightTargets();

  if (pocketWindow.__vceForgePocketBirdLoaded || document.getElementById(POCKET_BIRD_HOST_ID)) {
    pocketWindow.__vceForgePocketBirdLoaded = true;
    return;
  }

  if (document.getElementById(POCKET_BIRD_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = POCKET_BIRD_SCRIPT_ID;
  script.src = POCKET_BIRD_SRC;
  script.async = true;
  script.dataset.vceForgePocketBird = "true";
  script.onload = () => {
    pocketWindow.__vceForgePocketBirdLoaded = true;
    setPocketBirdVisible(true);
  };
  script.onerror = () => {
    pocketWindow.__vceForgePocketBirdLoaded = false;
  };
  document.body.appendChild(script);
};

export function ForgeMascot() {
  const activePalette = useActivePalette();
  const userId = useAuthStore((state) => state.user?.id);
  const subjects = useAppStore((state) => state.subjects);
  const askStudyQuestion = useAppStore((state) => state.askStudyQuestion);
  const createNote = useAppStore((state) => state.createNote);
  const [preferences, setPreferences] = useState<StudyPreferences>(DEFAULT_STUDY_PREFERENCES);
  const [open, setOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadStudyPreferences(userId).then((loaded) => {
      if (active) setPreferences(loaded);
    });
    const unsubscribe = subscribeStudyPreferences((nextPreferences) => setPreferences(nextPreferences));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedSubjectId && subjects[0]) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    if (!isWebDomAvailable()) return;
    if (preferences.mascotEnabled) {
      ensurePocketBirdScript();
      const poll = window.setInterval(() => setPocketBirdVisible(!open), 300);
      return () => window.clearInterval(poll);
    }

    setPocketBirdVisible(false);
    removePocketBirdFlightTargets();
  }, [open, preferences.mascotEnabled]);

  useEffect(() => {
    return () => {
      setPocketBirdVisible(false);
      removePocketBirdFlightTargets();
    };
  }, []);

  const openQuickAsk = useCallback(() => {
    setMessage(null);
    setAnswer(null);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!isWebDomAvailable() || !preferences.mascotEnabled) return;

    let observer: MutationObserver | null = null;
    const injectAskItem = () => {
      const host = getPocketBirdHost();
      const root = host?.shadowRoot;
      const content = root?.querySelector("#birb-menu .birb-window-content");
      if (!root || !content || root.querySelector(`#${POCKET_BIRD_ASK_ID}`)) return;

      const item = document.createElement("div");
      item.id = POCKET_BIRD_ASK_ID;
      item.className = "birb-menu-item";
      item.textContent = "Ask VCE Forge";
      item.setAttribute("role", "button");
      item.tabIndex = 0;

      const openFromMenu = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        root.querySelector("#birb-menu")?.remove();
        root.querySelector("#birb-menu-exit")?.remove();
        openQuickAsk();
      };

      item.addEventListener("click", openFromMenu);
      item.addEventListener("touchend", openFromMenu);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          openFromMenu(event);
        }
      });

      const separator = document.createElement("div");
      separator.id = POCKET_BIRD_ASK_SEPARATOR_ID;
      separator.className = "birb-window-separator";

      content.prepend(separator);
      content.prepend(item);
    };

    const connectObserver = () => {
      const root = getPocketBirdHost()?.shadowRoot;
      if (!root || observer) return;
      observer = new MutationObserver(injectAskItem);
      observer.observe(root, { childList: true, subtree: true });
      injectAskItem();
    };

    connectObserver();
    const poll = window.setInterval(connectObserver, 500);
    return () => {
      window.clearInterval(poll);
      observer?.disconnect();
    };
  }, [openQuickAsk, preferences.mascotEnabled]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0] ?? null,
    [selectedSubjectId, subjects]
  );

  const ask = async () => {
    const prompt = question.trim();
    if (!prompt) {
      setMessage("Ask one clear question first.");
      return;
    }

    setAsking(true);
    setMessage(null);
    setAnswer(null);
    try {
      const formData = new FormData();
      if (selectedSubject?.id) formData.append("subjectId", selectedSubject.id);
      formData.append("question", prompt);
      formData.append("responseMode", "direct");
      const nextAnswer = await askStudyQuestion(formData);
      setAnswer(nextAnswer);
      setMessage("Answered. Saved as a quick coach note.");
      try {
        await createNote({
          subjectId: selectedSubject?.id ?? null,
          title: `Quick ask: ${prompt}`.slice(0, 140),
          body: compactAnswer(nextAnswer),
          noteType: "general",
          tags: ["coach-answer", "quick-ask"]
        });
      } catch {
        setMessage("Answered, but the note could not be saved.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not answer that yet.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={[styles.modalCard, { backgroundColor: activePalette.surface, borderColor: activePalette.border }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={[styles.modalIcon, { backgroundColor: `${activePalette.primary}18` }]}>
                <MaterialCommunityIcons name="message-question-outline" color={activePalette.primary} size={25} />
              </View>
              <View style={styles.flexText}>
                <Text style={[styles.eyebrow, { color: activePalette.primary }]}>Quick ask</Text>
                <Text style={styles.modalTitle}>Ask from anywhere</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" color={palette.muted} size={22} />
            </Pressable>
          </View>

          {subjects.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
              {subjects.map((subject) => {
                const active = subject.id === selectedSubject?.id;
                return (
                  <Pressable
                    key={subject.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedSubjectId(subject.id)}
                    style={[
                      styles.subjectChip,
                      { borderColor: active ? subject.color : activePalette.border },
                      active && { backgroundColor: `${subject.color}18` }
                    ]}
                  >
                    <Text style={[styles.subjectChipText, active && { color: subject.color }]} numberOfLines={1}>
                      {subject.subjectName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <TextInput
            mode="outlined"
            label="What are you stuck on?"
            value={question}
            multiline
            numberOfLines={3}
            onChangeText={setQuestion}
          />

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {answer ? (
            <ScrollView style={styles.answerBox} contentContainerStyle={styles.answerContent}>
              <Text style={styles.answerText}>{answer.answer}</Text>
              {answer.key_points.length ? (
                <View style={styles.points}>
                  {answer.key_points.slice(0, 4).map((point) => (
                    <View key={point} style={styles.pointRow}>
                      <View style={styles.pointDot} />
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setOpen(false)}>
              Close
            </Button>
            <Button mode="contained" icon="send" loading={asking} disabled={asking} onPress={ask}>
              Ask
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(2, 6, 23, 0.62)"
  },
  modalCard: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "86%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 14
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  modalTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  modalIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  flexText: {
    flex: 1
  },
  eyebrow: {
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 21,
    lineHeight: 26
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)"
  },
  subjectRow: {
    gap: 8,
    paddingRight: 6
  },
  subjectChip: {
    minHeight: 38,
    maxWidth: 190,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  subjectChipText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold"
  },
  message: {
    color: palette.muted,
    fontSize: 14
  },
  answerBox: {
    maxHeight: 260,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    backgroundColor: "rgba(2, 6, 23, 0.22)"
  },
  answerContent: {
    padding: 12,
    gap: 12
  },
  answerText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22
  },
  points: {
    gap: 8
  },
  pointRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: palette.info
  },
  pointText: {
    flex: 1,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8
  }
});
