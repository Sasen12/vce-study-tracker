import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
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
import type { AdaptiveStudyTask, StudyAnswer, StudyEvent, StudentSubjectMemory } from "@/types";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type QuickAskRouteKey = "home" | "study" | "calendar" | "community" | "more" | "insights";

const POCKET_BIRD_SRC = "https://cdn.jsdelivr.net/gh/IdreesInc/Pocket-Bird@main/dist/web/birb.embed.js";
const POCKET_BIRD_SCRIPT_ID = "vce-forge-pocket-bird-script";
const POCKET_BIRD_HOST_ID = "birb-shadow-host";
const POCKET_BIRD_SAVE_KEY = "birbSaveData";
const POCKET_BIRD_ASK_ID = "vce-forge-pocket-bird-ask";
const POCKET_BIRD_ASK_SEPARATOR_ID = "vce-forge-pocket-bird-ask-separator";
const POCKET_BIRD_FLIGHT_TARGET_CLASS = "vce-pocket-bird-flight-target";
const POCKET_BIRD_SOURCE_URL = "pocket-bird-vce-forge.js";
const MASCOT_BUBBLE_ID = "vce-forge-mascot-bubble";
const MASCOT_BUBBLE_TEXT_ID = "vce-forge-mascot-bubble-text";
const MASCOT_BUBBLE_TAIL_ID = "vce-forge-mascot-bubble-tail";
const MASCOT_FIRST_CHECK_IN_DELAY_MS = 8000;
const MASCOT_CHECK_IN_INTERVAL_MS = 10 * 60 * 1000;
const MASCOT_CHECK_IN_JITTER_MS = 90 * 1000;
const MASCOT_CHECK_IN_VISIBLE_MS = 18000;
const MASCOT_BIRD_RETRY_MS = 12000;
const MASCOT_HIDDEN_TAB_RETRY_MS = 60000;
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const FLIGHT_TARGETS = [
  { x: 0.08, y: 0.18, width: 118 },
  { x: 0.7, y: 0.76, width: 132 },
  { x: 0.44, y: 0.5, width: 124 },
  { x: 0.2, y: 0.72, width: 136 },
  { x: 0.78, y: 0.32, width: 116 },
  { x: 0.54, y: 0.2, width: 128 },
  { x: 0.1, y: 0.46, width: 120 },
  { x: 0.86, y: 0.58, width: 112 }
];
const MASCOT_CHECK_INS = [
  "How are you going? If you are stuck, tap me and ask for the next tiny step.",
  "Hope you are well. One clear answer beats ten half-started tasks.",
  "Remember, if you ever have questions, you can always ask me.",
  "Quick check-in: water, stretch, then one VCE-style question?",
  "If a topic gets messy, ask me before it turns into a whole thing.",
  "Tiny repair time: what mistake keeps showing up?",
  "No need for perfect motivation. Give me the next stuck point."
];

const routeKeyForPath = (pathname: string): QuickAskRouteKey => {
  if (pathname.includes("study")) return "study";
  if (pathname.includes("calendar")) return "calendar";
  if (pathname.includes("community")) return "community";
  if (pathname.includes("insights")) return "insights";
  if (pathname.includes("more") || pathname.includes("questions") || pathname.includes("shop") || pathname.includes("profile")) return "more";
  return "home";
};

const routeActionFor = (routeKey: QuickAskRouteKey): { label: string; icon: IconName; route: "/(tabs)" | "/(tabs)/study" | "/(tabs)/calendar" | "/(tabs)/community" | "/(tabs)/more" | "/(tabs)/insights" } => {
  if (routeKey === "study") return { label: "Open timer", icon: "timer-outline", route: "/(tabs)/study" };
  if (routeKey === "calendar") return { label: "Open calendar", icon: "calendar-month", route: "/(tabs)/calendar" };
  if (routeKey === "community") return { label: "Open community", icon: "forum-outline", route: "/(tabs)/community" };
  if (routeKey === "insights") return { label: "Open insights", icon: "map-search-outline", route: "/(tabs)/insights" };
  if (routeKey === "more") return { label: "Open tools", icon: "dots-grid", route: "/(tabs)/more" };
  return { label: "Open Home", icon: "view-dashboard", route: "/(tabs)" };
};

const routeCopy: Record<QuickAskRouteKey, { eyebrow: string; title: string; body: string; icon: IconName; accent: string }> = {
  home: {
    eyebrow: "Home coach",
    title: "Ask about your next move",
    body: "Forge can use your deadline, weak area and plan context to decide what deserves attention now.",
    icon: "view-dashboard",
    accent: palette.info
  },
  study: {
    eyebrow: "Study coach",
    title: "Ask during the work",
    body: "Use this for a quick hint, method check or stuck-point repair without leaving the study flow.",
    icon: "timer-outline",
    accent: palette.success
  },
  calendar: {
    eyebrow: "Deadline coach",
    title: "Turn dates into a plan",
    body: "Ask what to do first, how to split prep, or whether a SAC needs panic planning.",
    icon: "calendar-month",
    accent: palette.warning
  },
  community: {
    eyebrow: "Community coach",
    title: "Ask before you post",
    body: "Turn a messy stuck point into a clean squad question or helpful reply.",
    icon: "forum-outline",
    accent: palette.primary
  },
  more: {
    eyebrow: "Tool coach",
    title: "Find the right tool",
    body: "Ask which extra tool fits the problem before opening everything at once.",
    icon: "dots-grid",
    accent: "#60A5FA"
  },
  insights: {
    eyebrow: "Student Map",
    title: "Ask what the evidence means",
    body: "Use weak areas, mistakes and patterns to pick a repair, not random revision.",
    icon: "map-search-outline",
    accent: "#A78BFA"
  }
};

type PocketBirdWindow = Window &
  typeof globalThis & {
    __vceForgePocketBirdLoaded?: boolean;
    __vceForgePocketBirdLoading?: boolean;
  };

type MascotBubbleTheme = {
  accent: string;
  background: string;
  border: string;
  text: string;
  muted: string;
};

let mascotBubbleFrame = 0;

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

const daysUntil = (eventDate: string) => {
  const today = new Date();
  const target = new Date(`${eventDate.slice(0, 10)}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const deadlineLabel = (event: StudyEvent) => {
  const days = daysUntil(event.eventDate);
  if (days < 0) return `${event.title} was due`;
  if (days === 0) return `${event.title} is today`;
  if (days === 1) return `${event.title} is tomorrow`;
  return `${event.title} is in ${days} days`;
};

const memoryRiskScore = (memory: StudentSubjectMemory) =>
  memory.riskLevel === "high" ? 3 : memory.riskLevel === "medium" ? 2 : memory.riskLevel === "low" ? 1 : 0;

const getPocketBirdHost = () => document.getElementById(POCKET_BIRD_HOST_ID) as HTMLElement | null;

const clamp = (value: number, min: number, max: number) => {
  const boundedMax = Math.max(min, max);
  return Math.min(Math.max(value, min), boundedMax);
};

const getPocketBirdRect = () => {
  if (!isWebDomAvailable()) return null;
  const bird = getPocketBirdHost()?.shadowRoot?.querySelector("#birb");
  const rect = bird?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
};

const setPocketBirdVisible = (visible: boolean) => {
  if (!isWebDomAvailable()) return;
  const host = getPocketBirdHost();
  if (!host) return;
  host.style.display = visible ? "" : "none";
  host.style.pointerEvents = visible ? "" : "none";
  host.setAttribute("aria-hidden", visible ? "false" : "true");
};

const ensureMascotBubble = (theme: MascotBubbleTheme, openQuickAsk: () => void) => {
  if (!isWebDomAvailable()) return null;

  let bubble = document.getElementById(MASCOT_BUBBLE_ID) as HTMLDivElement | null;
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.id = MASCOT_BUBBLE_ID;
    bubble.setAttribute("role", "button");
    bubble.setAttribute("aria-live", "polite");
    bubble.tabIndex = 0;

    const text = document.createElement("div");
    text.id = MASCOT_BUBBLE_TEXT_ID;
    bubble.appendChild(text);

    const hint = document.createElement("div");
    hint.textContent = "Tap to ask Forge";
    Object.assign(hint.style, {
      marginTop: "7px",
      color: theme.muted,
      fontSize: "11px",
      fontFamily: "Outfit_700Bold, system-ui, sans-serif",
      textTransform: "uppercase",
      letterSpacing: "0"
    });
    bubble.appendChild(hint);

    const tail = document.createElement("div");
    tail.id = MASCOT_BUBBLE_TAIL_ID;
    bubble.appendChild(tail);

    document.body.appendChild(bubble);
  }

  Object.assign(bubble.style, {
    position: "fixed",
    display: "none",
    zIndex: "2147483000",
    boxSizing: "border-box",
    padding: "12px 13px",
    borderRadius: "8px",
    border: `1px solid ${theme.border}`,
    borderTop: `3px solid ${theme.accent}`,
    background: theme.background,
    color: theme.text,
    boxShadow: "0 18px 48px rgba(2, 6, 23, 0.28)",
    fontFamily: "Outfit_400Regular, system-ui, sans-serif",
    fontSize: "14px",
    lineHeight: "19px",
    cursor: "pointer",
    pointerEvents: "none",
    userSelect: "none",
    opacity: "0",
    transform: "translateY(6px) scale(0.98)",
    transition: "opacity 160ms ease, transform 160ms ease"
  });

  const tail = document.getElementById(MASCOT_BUBBLE_TAIL_ID) as HTMLDivElement | null;
  if (tail) {
    Object.assign(tail.style, {
      position: "absolute",
      width: "14px",
      height: "14px",
      background: theme.background,
      transform: "rotate(45deg)",
      borderColor: theme.border,
      borderStyle: "solid"
    });
  }

  const openFromBubble = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    hideMascotBubble();
    openQuickAsk();
  };

  bubble.onclick = openFromBubble;
  bubble.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      openFromBubble(event);
    }
  };

  return bubble;
};

const positionMascotBubble = () => {
  if (!isWebDomAvailable()) return false;
  const bubble = document.getElementById(MASCOT_BUBBLE_ID) as HTMLDivElement | null;
  const tail = document.getElementById(MASCOT_BUBBLE_TAIL_ID) as HTMLDivElement | null;
  const rect = getPocketBirdRect();
  if (!bubble || !rect) return false;

  const gutter = 12;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const width = Math.min(278, Math.max(196, viewportWidth - gutter * 2));
  bubble.style.width = `${width}px`;

  const measuredHeight = Math.max(72, bubble.offsetHeight || 86);
  const showAbove = rect.top > measuredHeight + 26;
  const left = clamp(rect.left + rect.width / 2 - width / 2, gutter, viewportWidth - width - gutter);
  const topTarget = showAbove ? rect.top - measuredHeight - 14 : rect.bottom + 14;
  const top = clamp(topTarget, gutter, viewportHeight - measuredHeight - gutter);

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;

  if (tail) {
    const tailLeft = clamp(rect.left + rect.width / 2 - left - 7, 20, width - 34);
    tail.style.left = `${tailLeft}px`;
    tail.style.top = showAbove ? "" : "-7px";
    tail.style.bottom = showAbove ? "-7px" : "";
    tail.style.borderWidth = showAbove ? "0 1px 1px 0" : "1px 0 0 1px";
  }

  return true;
};

const startMascotBubbleTracking = () => {
  if (!isWebDomAvailable()) return;
  if (mascotBubbleFrame) window.cancelAnimationFrame(mascotBubbleFrame);

  const track = () => {
    const bubble = document.getElementById(MASCOT_BUBBLE_ID) as HTMLDivElement | null;
    if (!bubble || bubble.style.display === "none") {
      mascotBubbleFrame = 0;
      return;
    }
    positionMascotBubble();
    mascotBubbleFrame = window.requestAnimationFrame(track);
  };

  mascotBubbleFrame = window.requestAnimationFrame(track);
};

const hideMascotBubble = () => {
  if (!isWebDomAvailable()) return;
  if (mascotBubbleFrame) {
    window.cancelAnimationFrame(mascotBubbleFrame);
    mascotBubbleFrame = 0;
  }
  const bubble = document.getElementById(MASCOT_BUBBLE_ID) as HTMLDivElement | null;
  if (!bubble) return;
  bubble.style.display = "none";
  bubble.style.opacity = "0";
  bubble.style.pointerEvents = "none";
  bubble.style.transform = "translateY(6px) scale(0.98)";
};

const removeMascotBubble = () => {
  if (!isWebDomAvailable()) return;
  hideMascotBubble();
  document.getElementById(MASCOT_BUBBLE_ID)?.remove();
};

const showMascotBubble = (text: string, theme: MascotBubbleTheme, openQuickAsk: () => void) => {
  if (!isWebDomAvailable() || !getPocketBirdRect()) return false;
  const bubble = ensureMascotBubble(theme, openQuickAsk);
  const textElement = document.getElementById(MASCOT_BUBBLE_TEXT_ID);
  if (!bubble || !textElement) return false;

  textElement.textContent = text;
  bubble.setAttribute("aria-label", `${text} Tap to ask Forge.`);
  bubble.style.display = "block";
  bubble.style.pointerEvents = "auto";
  positionMascotBubble();
  startMascotBubbleTracking();
  window.requestAnimationFrame(() => {
    bubble.style.opacity = "1";
    bubble.style.transform = "translateY(0) scale(1)";
  });
  return true;
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

const tunePocketBirdSource = (source: string) =>
  source
    .replace("const AFK_TIME = isDebug() ? 0 : 1000 * 5;", "const AFK_TIME = 1000 * 1.2;")
    .replace("const FOCUS_SWITCH_CHANCE = 1 / (60 * 20);", "const FOCUS_SWITCH_CHANCE = 1 / (60 * 3.5);");

const ensurePocketBirdFlightTargets = () => {
  if (!isWebDomAvailable() || document.querySelector(`.${POCKET_BIRD_FLIGHT_TARGET_CLASS}`)) return;

  FLIGHT_TARGETS.forEach((target, index) => {
    const image = document.createElement("img");
    image.src = TRANSPARENT_PIXEL;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.className = POCKET_BIRD_FLIGHT_TARGET_CLASS;
    image.style.position = "fixed";
    image.style.left = `${target.x * 100}%`;
    image.style.top = `${target.y * 100}%`;
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

  if (pocketWindow.__vceForgePocketBirdLoading) return;

  if (pocketWindow.__vceForgePocketBirdLoaded || document.getElementById(POCKET_BIRD_HOST_ID)) {
    pocketWindow.__vceForgePocketBirdLoaded = true;
    return;
  }

  if (document.getElementById(POCKET_BIRD_SCRIPT_ID)) return;

  pocketWindow.__vceForgePocketBirdLoading = true;
  const script = document.createElement("script");
  script.id = POCKET_BIRD_SCRIPT_ID;
  script.async = true;
  script.dataset.vceForgePocketBird = "true";
  let objectUrl: string | null = null;

  script.onload = () => {
    pocketWindow.__vceForgePocketBirdLoaded = true;
    pocketWindow.__vceForgePocketBirdLoading = false;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setPocketBirdVisible(true);
  };
  script.onerror = () => {
    pocketWindow.__vceForgePocketBirdLoaded = false;
    pocketWindow.__vceForgePocketBirdLoading = false;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };

  const attachScript = (source: string) => {
    script.src = source;
    document.body.appendChild(script);
  };

  fetch(POCKET_BIRD_SRC)
    .then((response) => {
      if (!response.ok) throw new Error(`Pocket-Bird fetch failed: ${response.status}`);
      return response.text();
    })
    .then((source) => {
      const tunedSource = `${tunePocketBirdSource(source)}\n//# sourceURL=${POCKET_BIRD_SOURCE_URL}`;
      objectUrl = URL.createObjectURL(new Blob([tunedSource], { type: "text/javascript" }));
      attachScript(objectUrl);
    })
    .catch(() => {
      attachScript(POCKET_BIRD_SRC);
    });
};

export function ForgeMascot() {
  const activePalette = useActivePalette();
  const pathname = usePathname();
  const userId = useAuthStore((state) => state.user?.id);
  const subjects = useAppStore((state) => state.subjects);
  const events = useAppStore((state) => state.events);
  const latestPlan = useAppStore((state) => state.latestPlan);
  const subjectMemories = useAppStore((state) => state.subjectMemories);
  const askStudyQuestion = useAppStore((state) => state.askStudyQuestion);
  const createNote = useAppStore((state) => state.createNote);
  const [preferences, setPreferences] = useState<StudyPreferences>(DEFAULT_STUDY_PREFERENCES);
  const [open, setOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mascotMessageIndexRef = useRef(0);
  const lastMascotCheckInAtRef = useRef(0);

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
      return () => {
        window.clearInterval(poll);
      };
    }

    setPocketBirdVisible(false);
    removeMascotBubble();
    removePocketBirdFlightTargets();
  }, [open, preferences.mascotEnabled]);

  useEffect(() => {
    return () => {
      setPocketBirdVisible(false);
      removeMascotBubble();
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
  const routeKey = routeKeyForPath(pathname);
  const pageCopy = routeCopy[routeKey];
  const pageAction = routeActionFor(routeKey);
  const mascotBubbleTheme = useMemo<MascotBubbleTheme>(
    () => ({
      accent: pageCopy.accent,
      background: activePalette.surfaceRaised,
      border: activePalette.border,
      text: activePalette.text,
      muted: activePalette.muted
    }),
    [activePalette.border, activePalette.muted, activePalette.surfaceRaised, activePalette.text, pageCopy.accent]
  );
  const nearestDeadline = useMemo(
    () =>
      [...events]
        .filter((event) => daysUntil(event.eventDate) >= 0)
        .sort((a, b) => daysUntil(a.eventDate) - daysUntil(b.eventDate))[0] ?? null,
    [events]
  );
  const weakestMemory = useMemo(
    () =>
      [...subjectMemories].sort((a, b) => {
        const riskGap = memoryRiskScore(b) - memoryRiskScore(a);
        if (riskGap !== 0) return riskGap;
        return (b.weakAreas?.length ?? 0) - (a.weakAreas?.length ?? 0);
      })[0] ?? null,
    [subjectMemories]
  );
  const nextPlanTask: AdaptiveStudyTask | null = latestPlan?.tasks?.[0] ?? null;
  const starterPrompts = useMemo(() => {
    const subjectName = selectedSubject?.subjectName ?? weakestMemory?.subjectName ?? "my subject";
    const deadline = nearestDeadline ? deadlineLabel(nearestDeadline) : "my next SAC or exam";
    const weakArea = weakestMemory?.predictedNextTask ?? weakestMemory?.subjectName ?? "my weakest area";
    const planTask = nextPlanTask?.title ?? "tonight's study block";
    const prompts: Record<QuickAskRouteKey, string[]> = {
      home: [
        `What should I study tonight for ${subjectName}?`,
        `Turn ${deadline} into a simple plan.`,
        `What is the smallest useful move for ${weakArea}?`
      ],
      study: [
        `Give me a hint for ${subjectName}, not the full answer.`,
        `Make ${planTask} easier to start.`,
        "Check if my approach would earn marks."
      ],
      calendar: [
        `How should I prepare for ${deadline}?`,
        "Split this assessment into three study blocks.",
        "What should I do if I only have 25 minutes?"
      ],
      community: [
        `Turn my confusion in ${subjectName} into a clean squad question.`,
        "Help me write a useful answer to another student.",
        "What should I ask without oversharing personal info?"
      ],
      more: [
        "Which tool should I use for this problem?",
        "Give me a one-minute reset before I study.",
        `What extra tool helps with ${subjectName}?`
      ],
      insights: [
        `What does my ${weakestMemory?.subjectName ?? subjectName} weak area mean?`,
        "Turn this mistake pattern into a drill.",
        "What evidence should I create next?"
      ]
    };
    return prompts[routeKey];
  }, [nearestDeadline, nextPlanTask, routeKey, selectedSubject?.subjectName, weakestMemory]);
  const contextLines = useMemo(
    () =>
      [
        `Student opened Ask Forge from: ${pageCopy.eyebrow}.`,
        selectedSubject ? `Selected subject: ${selectedSubject.subjectName} (${selectedSubject.unit}).` : null,
        nearestDeadline ? `Nearest deadline: ${deadlineLabel(nearestDeadline)}.` : null,
        weakestMemory
          ? `Student Map signal: ${weakestMemory.subjectName} risk is ${weakestMemory.riskLevel}; predicted next task: ${weakestMemory.predictedNextTask ?? "not enough evidence yet"}.`
          : null,
        nextPlanTask ? `Current suggested plan task: ${nextPlanTask.title} (${nextPlanTask.minutes} minutes).` : null
      ].filter(Boolean) as string[],
    [nearestDeadline, nextPlanTask, pageCopy.eyebrow, selectedSubject, weakestMemory]
  );

  useEffect(() => {
    if (!isWebDomAvailable()) return;

    if (!preferences.mascotEnabled || open) {
      hideMascotBubble();
      return;
    }

    let disposed = false;
    let showTimer = 0;
    let hideTimer = 0;

    const clearHideTimer = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
    };

    const showCheckIn = () => {
      if (disposed || document.hidden) return false;

      const checkIn = MASCOT_CHECK_INS[mascotMessageIndexRef.current % MASCOT_CHECK_INS.length];
      const shown = showMascotBubble(checkIn, mascotBubbleTheme, openQuickAsk);
      if (!shown) return false;

      mascotMessageIndexRef.current = (mascotMessageIndexRef.current + 1) % MASCOT_CHECK_INS.length;
      lastMascotCheckInAtRef.current = Date.now();
      clearHideTimer();
      hideTimer = window.setTimeout(() => hideMascotBubble(), MASCOT_CHECK_IN_VISIBLE_MS);
      return true;
    };

    const scheduleNext = (delay: number) => {
      showTimer = window.setTimeout(() => {
        const shown = showCheckIn();
        const nextDelay = shown
          ? MASCOT_CHECK_IN_INTERVAL_MS + Math.floor(Math.random() * MASCOT_CHECK_IN_JITTER_MS)
          : document.hidden
            ? MASCOT_HIDDEN_TAB_RETRY_MS
            : MASCOT_BIRD_RETRY_MS;
        scheduleNext(nextDelay);
      }, delay);
    };

    const elapsedSinceLast = lastMascotCheckInAtRef.current ? Date.now() - lastMascotCheckInAtRef.current : 0;
    const firstDelay = lastMascotCheckInAtRef.current
      ? Math.max(MASCOT_BIRD_RETRY_MS, MASCOT_CHECK_IN_INTERVAL_MS - elapsedSinceLast)
      : MASCOT_FIRST_CHECK_IN_DELAY_MS;
    scheduleNext(firstDelay);

    return () => {
      disposed = true;
      if (showTimer) window.clearTimeout(showTimer);
      clearHideTimer();
      hideMascotBubble();
    };
  }, [mascotBubbleTheme, open, openQuickAsk, preferences.mascotEnabled]);

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
      formData.append("question", `${contextLines.join("\n")}\n\nStudent question: ${prompt}`);
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
              <View style={[styles.modalIcon, { backgroundColor: `${pageCopy.accent}18` }]}>
                <MaterialCommunityIcons name={pageCopy.icon} color={pageCopy.accent} size={25} />
              </View>
              <View style={styles.flexText}>
                <Text style={[styles.eyebrow, { color: pageCopy.accent }]}>{pageCopy.eyebrow}</Text>
                <Text style={styles.modalTitle}>{pageCopy.title}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" color={palette.muted} size={22} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>{pageCopy.body}</Text>

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

          <View style={styles.promptGrid}>
            {starterPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                accessibilityRole="button"
                onPress={() => setQuestion(prompt)}
                style={[styles.promptChip, { borderColor: `${pageCopy.accent}35`, backgroundColor: `${pageCopy.accent}10` }]}
              >
                <MaterialCommunityIcons name="lightbulb-on-outline" color={pageCopy.accent} size={15} />
                <Text style={styles.promptText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            mode="outlined"
            label="Ask Forge"
            placeholder={starterPrompts[0]}
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
              {answer.follow_up_questions.length ? (
                <View style={styles.followUpGrid}>
                  {answer.follow_up_questions.slice(0, 3).map((followUp) => (
                    <Pressable key={followUp} accessibilityRole="button" style={styles.followUpChip} onPress={() => setQuestion(followUp)}>
                      <MaterialCommunityIcons name="arrow-right" color={pageCopy.accent} size={14} />
                      <Text style={styles.followUpText}>{followUp}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.modalActions}>
            <Button mode="outlined" compact icon={pageAction.icon} onPress={() => router.push(pageAction.route)}>
              {pageAction.label}
            </Button>
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
  modalBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20
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
  promptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  promptChip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    flexBasis: 170,
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  promptText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 16
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
  followUpGrid: {
    gap: 8
  },
  followUpChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  followUpText: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    lineHeight: 16
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8
  }
});
