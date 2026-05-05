import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, Dialog, Portal, Text } from "react-native-paper";
import { AppCard } from "@/components/ui/AppCard";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { palette } from "@/constants/theme";
import { studyApi } from "@/services/studyApi";
import { useAppStore } from "@/store/appStore";
import type { ResourceSourceType, StudyResource, UserSubject } from "@/types";

type StudyResourcesPanelProps = {
  subjects: UserSubject[];
  selectedSubjectId: string | null;
  onSelectSubject: (subject: UserSubject) => void;
};

type SourceType = Extract<
  ResourceSourceType,
  "textbook" | "obsidian" | "notes" | "exam" | "exam_report" | "practice_sac" | "practice_sat"
>;

const sourceLabels: Record<SourceType, string> = {
  textbook: "Textbook file",
  obsidian: "Obsidian MD",
  notes: "Word / notes",
  exam: "Exam paper",
  exam_report: "Exam report",
  practice_sac: "Practice SAC",
  practice_sat: "Practice SAT"
};

const sourceTabLabels: Record<SourceType, string> = {
  textbook: "Textbook",
  obsidian: "Obsidian",
  notes: "Notes",
  exam: "Exam paper",
  exam_report: "Exam report",
  practice_sac: "Practice SAC",
  practice_sat: "Practice SAT"
};

const sourceTypes: SourceType[] = ["textbook", "notes", "exam", "exam_report", "practice_sac", "practice_sat", "obsidian"];

const sourceMessages: Record<SourceType, string> = {
  textbook: "Textbook context added.",
  obsidian: "Obsidian notes imported.",
  notes: "Notes file imported.",
  exam: "Exam paper added to the question bank.",
  exam_report: "Exam report added to the marking knowledge base.",
  practice_sac: "Practice SAC added to the question bank.",
  practice_sat: "Practice SAT added to the question bank."
};

const pdfTypes = ["application/pdf"];
const wordTypes = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc",
  ".docx"
];
const textTypes = ["text/markdown", "text/plain", "application/octet-stream", ".md", ".txt"];

const acceptedTypesFor = (sourceType: SourceType) => {
  if (sourceType === "obsidian") return textTypes;
  if (sourceType === "notes") return [...wordTypes, ...textTypes];
  return [...pdfTypes, ...wordTypes];
};

const iconFor = (sourceType: SourceType) => {
  if (sourceType === "obsidian") return "folder-upload";
  if (sourceType === "notes") return "file-word-box";
  return "file-document-outline";
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

const downloadFileName = (fileName: string) => {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "study-resource";
  return `${baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")}.txt`;
};

const ResourceRow = ({
  resource,
  opening,
  deleting,
  confirmingDelete,
  onOpen,
  onDelete
}: {
  resource: StudyResource;
  opening: boolean;
  deleting: boolean;
  confirmingDelete: boolean;
  onOpen: (resource: StudyResource) => void;
  onDelete: (resource: StudyResource) => void;
}) => (
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
    <View style={styles.resourceActions}>
      <Button mode="text" compact icon="open-in-new" loading={opening} onPress={() => onOpen(resource)}>
        Open
      </Button>
      <Button
        mode="text"
        compact
        icon={confirmingDelete ? "check" : "delete-outline"}
        textColor={confirmingDelete ? palette.secondary : palette.muted}
        loading={deleting}
        onPress={() => onDelete(resource)}
      >
        {confirmingDelete ? "Confirm" : "Delete"}
      </Button>
    </View>
  </View>
);

export function StudyResourcesPanel({ subjects, selectedSubjectId, onSelectSubject }: StudyResourcesPanelProps) {
  const { resources, uploadResources, deleteResource } = useAppStore();
  const [selectedSourceType, setSelectedSourceType] = useState<SourceType>("textbook");
  const [uploading, setUploading] = useState<SourceType | null>(null);
  const [openingResourceId, setOpeningResourceId] = useState<string | null>(null);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingResource, setViewingResource] = useState<StudyResource | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const subjectResources = useMemo(
    () => resources.filter((resource) => !selectedSubjectId || resource.subjectId === selectedSubjectId),
    [resources, selectedSubjectId]
  );
  const resourceCounts = useMemo(
    () =>
      sourceTypes.reduce<Record<SourceType, number>>((acc, sourceType) => {
        acc[sourceType] = subjectResources.filter((resource) => resource.sourceType === sourceType).length;
        return acc;
      }, {} as Record<SourceType, number>),
    [subjectResources]
  );
  const visibleResources = useMemo(
    () => subjectResources.filter((resource) => resource.sourceType === selectedSourceType),
    [selectedSourceType, subjectResources]
  );

  const pickFiles = async (sourceType: SourceType) => {
    setUploading(sourceType);
    setMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedTypesFor(sourceType),
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

  const openResource = async (resource: StudyResource) => {
    setOpeningResourceId(resource.id);
    setMessage(null);
    try {
      const data = await studyApi.resource(resource.id);
      setViewingResource(data.resource);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open that resource.");
    } finally {
      setOpeningResourceId(null);
    }
  };

  const removeResource = async (resource: StudyResource) => {
    if (confirmDeleteId !== resource.id) {
      setConfirmDeleteId(resource.id);
      setMessage("Tap confirm to remove that file.");
      return;
    }

    setDeletingResourceId(resource.id);
    setMessage(null);
    try {
      await deleteResource(resource.id);
      if (viewingResource?.id === resource.id) setViewingResource(null);
      setConfirmDeleteId(null);
      setMessage("File removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove that file.");
    } finally {
      setDeletingResourceId(null);
    }
  };

  const downloadResourceText = () => {
    if (Platform.OS !== "web" || !viewingResource?.extractedText || typeof document === "undefined") return;
    const blob = new Blob([viewingResource.extractedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadFileName(viewingResource.fileName);
    link.click();
    URL.revokeObjectURL(url);
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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resourceTabs}>
          {sourceTypes.map((sourceType) => {
            const selected = selectedSourceType === sourceType;
            return (
              <Pressable
                key={sourceType}
                onPress={() => setSelectedSourceType(sourceType)}
                style={[styles.resourceTab, selected && styles.resourceTabSelected]}
              >
                <Text style={[styles.resourceTabText, selected && styles.resourceTabTextSelected]}>
                  {sourceTabLabels[sourceType]}
                </Text>
                <View style={[styles.resourceTabCount, selected && styles.resourceTabCountSelected]}>
                  <Text style={[styles.resourceTabCountText, selected && styles.resourceTabCountTextSelected]}>
                    {resourceCounts[sourceType]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Button
          mode="contained"
          icon={iconFor(selectedSourceType)}
          loading={uploading === selectedSourceType}
          disabled={!!uploading}
          onPress={() => pickFiles(selectedSourceType)}
        >
          Upload {sourceLabels[selectedSourceType]}
        </Button>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.listHeader}>
          <Text variant="titleMedium" style={styles.title}>
            {sourceTabLabels[selectedSourceType]}
          </Text>
          <Text style={styles.muted}>
            {visibleResources.length} file{visibleResources.length === 1 ? "" : "s"}
          </Text>
        </View>
        {visibleResources.length ? (
          visibleResources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              opening={openingResourceId === resource.id}
              deleting={deletingResourceId === resource.id}
              confirmingDelete={confirmDeleteId === resource.id}
              onOpen={openResource}
              onDelete={removeResource}
            />
          ))
        ) : (
          <Text style={styles.muted}>
            No {sourceTabLabels[selectedSourceType].toLowerCase()} files for {selectedSubject?.subjectName ?? "this subject"}.
          </Text>
        )}
      </AppCard>

      <Portal>
        <Dialog visible={Boolean(viewingResource)} onDismiss={() => setViewingResource(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{viewingResource?.fileName}</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.resourceDialogScroll} contentContainerStyle={styles.resourceDialogContent}>
              <Text style={styles.muted}>
                {viewingResource?.subject?.subjectName ?? "General"} - {viewingResource?.sourceType}
              </Text>
              <Text style={styles.resourceFullText}>
                {viewingResource?.extractedText || viewingResource?.extractedTextPreview || "No readable text was extracted."}
              </Text>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            {Platform.OS === "web" && viewingResource?.extractedText ? (
              <Button icon="download" onPress={downloadResourceText}>
                Download text
              </Button>
            ) : null}
            <Button onPress={() => setViewingResource(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  resourceTabs: {
    gap: 8,
    paddingRight: 2
  },
  resourceTab: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  resourceTabSelected: {
    borderColor: `${palette.info}88`,
    backgroundColor: `${palette.info}1C`
  },
  resourceTabText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 13
  },
  resourceTabTextSelected: {
    color: palette.text
  },
  resourceTabCount: {
    minWidth: 24,
    minHeight: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 7
  },
  resourceTabCountSelected: {
    backgroundColor: `${palette.info}33`
  },
  resourceTabCountText: {
    color: palette.muted,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  resourceTabCountTextSelected: {
    color: palette.info
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap"
  },
  resourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    minWidth: 0,
    gap: 3
  },
  resourceTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  resourceActions: {
    alignItems: "flex-end",
    gap: 2
  },
  preview: {
    color: palette.muted,
    lineHeight: 19
  },
  dialog: {
    backgroundColor: palette.surface
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  resourceDialogScroll: {
    maxHeight: 460
  },
  resourceDialogContent: {
    gap: 12
  },
  resourceFullText: {
    color: palette.text,
    lineHeight: 21
  },
  message: {
    color: palette.success,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
