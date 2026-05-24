import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "@/constants/theme";

export type StudySessionPresetId = "rescue" | "mistake" | "sac" | "deep" | "low-energy";

export type StudySessionPreset = {
  id: StudySessionPresetId;
  label: string;
  minutes: number;
  topicHint: string;
  goal: string;
  checkIns: boolean;
  focus: boolean;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  accent: string;
};

export const STUDY_SESSION_PRESETS: StudySessionPreset[] = [
  {
    id: "rescue",
    label: "Rescue sprint",
    minutes: 12,
    topicHint: "one weak point",
    goal: "Make one weak area less annoying.",
    checkIns: false,
    focus: true,
    icon: "lifebuoy",
    accent: palette.secondary
  },
  {
    id: "mistake",
    label: "Mistake repair",
    minutes: 25,
    topicHint: "mistake log repair",
    goal: "Redo one mistake and write the rule that fixes it.",
    checkIns: true,
    focus: false,
    icon: "backup-restore",
    accent: palette.warning
  },
  {
    id: "sac",
    label: "SAC drill",
    minutes: 35,
    topicHint: "SAC-style response",
    goal: "Attempt, mark, correct, then repeat the weakest bit.",
    checkIns: true,
    focus: false,
    icon: "file-document-edit-outline",
    accent: palette.info
  },
  {
    id: "deep",
    label: "Deep work",
    minutes: 50,
    topicHint: "deep work block",
    goal: "Build one complete piece of evidence.",
    checkIns: true,
    focus: true,
    icon: "timer-sand-full",
    accent: palette.primary
  },
  {
    id: "low-energy",
    label: "Low energy",
    minutes: 10,
    topicHint: "easy restart",
    goal: "Start gently and protect the streak.",
    checkIns: false,
    focus: false,
    icon: "battery-30",
    accent: palette.success
  }
];

export const studySessionPresetById = (id: string | null | undefined) =>
  STUDY_SESSION_PRESETS.find((preset) => preset.id === id) ?? STUDY_SESSION_PRESETS[1];
