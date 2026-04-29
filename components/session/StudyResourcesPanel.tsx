import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, Text } from "react-native-paper";
import { AppCard } from "@/components/ui/AppCard";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { ResourceSourceType, StudyResource, UserSubject } from "@/types";

type StudyResourcesPanelProps = {
  subjects: UserSubject[];
  selectedSubjectId: string | null;
  onSelectSubject: (subject: UserSubject) => void;
};

type SourceType = Extract<ResourceSourceType, "textbook" | "obsidian" | "exam" | "exam_report" | "practice_sac" | "practice_sat">;

const sourceLabels: Record<SourceType, string> = {
  textbook: "Textbook PDF",
  obsidian: "Obsidian MD",
  exam: "Exam paper",
  exam_report: "Exam report",
  practice_sac: "Practice SAC",
  practice_sat: "Practice SAT"
};

const sourceMessages: Record<SourceType, string> = {
  textbook: "Textbook context added.",
  obsidian: "Obsidian notes imported.",
  exam: "Exam paper added to the question bank.",
  exam_report: "Exam report added to the marking knowledge base.",
  practice_sac: "Practice SAC added to the question bank.",
  practice_sat: "Practice SAT added to the question bank."
};

const appendAsset = (formData: FormData, asset: DocumentPicker.DocumentPickerAsset) => {
  const webFile = Platform.OS === "web" ? (asset as DocumentPicker.DocumentPickerAsset & { file?: Blob }).file : null;
  if (webFile) {
    formData.append("files", webFile, asset.name);
    return;
  }

  formData.append("files", {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? "application/octet-stream"
  } as unknown as Blob);
};

const ResourceRow = ({ resource }: { resource: StudyResource }) => (
  <View style={styles.resourceRow}>
    <View style={styles.fileBadge}>
      <Text style={styles.fileBadgeText}>{resource.fileType.toUpperCase().slice(0, 3)}</Text>
    </View>
    <View style={styles.resourceText}>
      <Text style={styles.resourceTitle}>{resource.fileName}</Text>
      <Text style={styles.muted}>
        {resource.subject?.subjectName ?? "General"} - {resource.sourceType}
      </Text>
      {resource.extractedTextPreview ? (
        <Text numberOfLines={2} style={styles.preview}>
          {resource.extractedTextPreview}
        </Text>
      ) : null}
    </View>
  </View>
);

export function StudyResourcesPanel({ subjects, selectedSubjectId, onSelectSubject }: StudyResourcesPanelProps) {
  const { resources, uploadResources } = useAppStore();
  const [uploading, setUploading] = useState<SourceType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const visibleResources = useMemo(
    () => resources.filter((resource) => !selectedSubjectId || resource.subjectId === selectedSubjectId).slice(0, 8),
    [resources, selectedSubjectId]
  );

  const pickFiles = async (sourceType: SourceType) => {
    setUploading(sourceType);
    setMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type:
          sourceType === "textbook" || sourceType === "exam" || sourceType === "exam_report" || sourceType === "practice_sac" || sourceType === "practice_sat"
            ? ["application/pdf"]
            : ["text/markdown", "text/plain", "application/octet-stream"],
        multiple: true,
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const formData = new FormData();
      if (selectedSubjectId) formData.append("subjectId", selectedSubjectId);
      formData.append("sourceType", sourceType);
      result.assets.forEach((asset) => appendAsset(formData, asset));

      await uploadResources(formData);
      setMessage(sourceMessages[sourceType]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <View style={styles.stack}>
      <SubjectSelector subjects={subjects} selectedId={selectedSubjectId} onSelect={onSelectSubject} />

      <AppCard style={styles.card}>
        <View>
          <Text variant="titleLarge" style={styles.title}>
            Resources
          </Text>
          <Text style={styles.muted}>{selectedSubject?.subjectName ?? "Choose a subject"}</Text>
        </View>

        <View style={styles.buttons}>
          {(["textbook", "exam", "exam_report", "practice_sac", "practice_sat", "obsidian"] as SourceType[]).map((sourceType) => (
            <Button
              key={sourceType}
              mode={sourceType === "textbook" ? "contained" : "outlined"}
              icon={sourceType === "obsidian" ? "folder-upload" : "file-pdf-box"}
              loading={uploading === sourceType}
              disabled={!!uploading}
              onPress={() => pickFiles(sourceType)}
            >
              {sourceLabels[sourceType]}
            </Button>
          ))}
        </View>
      </AppCard>

      {visibleResources.length ? (
        <AppCard style={styles.card}>
          <Text variant="titleMedium" style={styles.title}>
            Uploaded context
          </Text>
          {visibleResources.map((resource) => (
            <ResourceRow key={resource.id} resource={resource} />
          ))}
        </AppCard>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  card: {
    gap: 12
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  resourceRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  fileBadge: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.info}22`,
    borderWidth: 1,
    borderColor: `${palette.info}55`
  },
  fileBadgeText: {
    color: palette.info,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  resourceText: {
    flex: 1,
    gap: 3
  },
  resourceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  preview: {
    color: palette.muted,
    lineHeight: 19
  },
  message: {
    color: palette.success,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
