import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Button, Dialog, Portal, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { ClassNotetakerPanel } from "@/components/session/ClassNotetakerPanel";
import { AppCard } from "@/components/ui/AppCard";
import { SubjectSelector } from "@/components/ui/SubjectSelector";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { StudyNote, StudyNoteType, UserSubject } from "@/types";

type StudyNotesPanelProps = {
  subjects: UserSubject[];
  selectedSubjectId: string | null;
  onSelectSubject: (subject: UserSubject) => void;
};

type NoteImage = {
  id: string;
  name: string;
  dataUrl: string;
};

type PickedImageAsset = {
  name?: string;
  mimeType?: string;
  file?: Blob;
};

const generalMathTemplates: Record<StudyNoteType, string> = {
  general: "",
  worked_example: "Question:\n\nKnown information:\n\nSteps:\n1. \n2. \n3. \n\nCalculator/CAS steps:\n\nAnswer:\n\nWhy this works:\n",
  formula: "Formula:\n\nWhen to use it:\n\nConditions / restrictions:\n\nExample:\n\nCommon trap:\n",
  mistake_log: "Original error:\n\nCorrect method:\n\nWhy I made the mistake:\n\nCheck I will use next time:\n"
};

const imageMarkdownPattern = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
const maxNoteImages = 6;

const embeddedImagesFromBody = (value: string): NoteImage[] =>
  [...value.matchAll(imageMarkdownPattern)].map((match, index) => ({
    id: `${index}-${match[1]}`,
    name: match[1] || `image-${index + 1}`,
    dataUrl: match[2]
  }));

const bodyWithoutImages = (value: string) => value.replace(imageMarkdownPattern, "").replace(/\n{3,}/g, "\n\n").trim();

const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });

const compressImage = async (file: Blob) => {
  const original = await fileToDataUrl(file);
  if (Platform.OS !== "web" || typeof document === "undefined") return original;

  return new Promise<string>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(original);
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => resolve(original);
    image.src = original;
  });
};

const formatBodyWithImages = (text: string, images: NoteImage[]) =>
  [
    text.trim(),
    ...images.map((image) => `![${image.name.replace(/[\[\]\n]/g, " ").trim() || "note image"}](${image.dataUrl})`)
  ]
    .filter(Boolean)
    .join("\n\n");

export function StudyNotesPanel({ subjects, selectedSubjectId, onSelectSubject }: StudyNotesPanelProps) {
  const { notes, createNote, deleteNote } = useAppStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<NoteImage[]>([]);
  const [noteType, setNoteType] = useState<StudyNoteType>("general");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<StudyNote | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const isGeneralMath = selectedSubject?.subjectName.toLowerCase().includes("general mathematics");
  const visibleNotes = useMemo(
    () => notes.filter((note) => !selectedSubjectId || note.subjectId === selectedSubjectId).slice(0, 6),
    [notes, selectedSubjectId]
  );
  const viewingNoteImages = useMemo(() => (viewingNote ? embeddedImagesFromBody(viewingNote.body) : []), [viewingNote]);
  const viewingNoteBody = viewingNote ? bodyWithoutImages(viewingNote.body) : "";

  const addImageFiles = useCallback(async (files: { file: Blob; name: string }[]) => {
    if (!files.length) return;

    const remainingSlots = maxNoteImages - images.length;
    if (remainingSlots <= 0) {
      setMessage(`You can attach up to ${maxNoteImages} images per note.`);
      return;
    }

    try {
      const nextImages = await Promise.all(
        files.slice(0, remainingSlots).map(async (asset, index) => ({
          id: `${Date.now()}-${index}-${asset.name}`,
          name: asset.name,
          dataUrl: await compressImage(asset.file)
        }))
      );
      setImages((current) => [...current, ...nextImages]);
      setMessage(`${nextImages.length} image${nextImages.length === 1 ? "" : "s"} attached.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not attach image.");
    }
  }, [images.length]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return undefined;

    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (!files.length) return;
      event.preventDefault();
      void addImageFiles(
        files.map((file, index) => ({
          file,
          name: file.name || `pasted-note-image-${Date.now()}-${index + 1}.jpg`
        }))
      );
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addImageFiles]);

  const changeType = (value: string) => {
    const next = value as StudyNoteType;
    setNoteType(next);
    if (!body.trim()) {
      setBody(generalMathTemplates[next]);
    }
  };

  const save = async () => {
    if (!selectedSubject || !title.trim() || (!body.trim() && !images.length)) {
      setMessage("Add a title and note first.");
      return;
    }

    setSaving(true);
    try {
      const noteBody = formatBodyWithImages(body, images);
      await createNote({
        subjectId: selectedSubject.id,
        title: title.trim(),
        body: noteBody,
        noteType: isGeneralMath ? noteType : "general"
      });
      setTitle("");
      setBody("");
      setImages([]);
      setNoteType("general");
      setMessage("Note saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save note.");
    } finally {
      setSaving(false);
    }
  };

  const addImages = async () => {
    setMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/*"],
      multiple: true,
      copyToCacheDirectory: true
    });

    if (result.canceled) return;

    const assets = (result.assets as PickedImageAsset[])
      .filter((asset) => asset.file && (asset.mimeType?.startsWith("image/") ?? true))
      .map((asset, index) => ({
        file: asset.file as Blob,
        name: asset.name || `note-image-${Date.now()}-${index + 1}.jpg`
      }));

    if (!assets.length) {
      setMessage("Image upload works best in the web app.");
      return;
    }

    await addImageFiles(assets);
  };

  const removeImage = (id: string) => {
    setImages((current) => current.filter((image) => image.id !== id));
  };

  const removeNote = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setMessage("Tap confirm to delete that note.");
      return;
    }

    setDeletingId(id);
    try {
      await deleteNote(id);
      setConfirmDeleteId(null);
      setMessage("Note deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete note.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={styles.stack}>
      <SubjectSelector subjects={subjects} selectedId={selectedSubjectId} onSelect={onSelectSubject} />
      <ClassNotetakerPanel selectedSubject={selectedSubject} />

      <AppCard style={styles.card}>
        <View>
          <Text variant="titleLarge" style={styles.title}>
            Notes
          </Text>
          <Text style={styles.muted}>{selectedSubject?.subjectName ?? "Choose a subject"}</Text>
        </View>

        {isGeneralMath ? (
          <SegmentedButtons
            value={noteType}
            onValueChange={changeType}
            buttons={[
              { value: "worked_example", label: "Example" },
              { value: "formula", label: "Formula" },
              { value: "mistake_log", label: "Error log" },
              { value: "general", label: "Note" }
            ]}
          />
        ) : null}

        <TextInput mode="outlined" label="Title" value={title} onChangeText={setTitle} />
        <TextInput
          mode="outlined"
          label={isGeneralMath ? "Structured note" : "Note"}
          value={body}
          multiline
          numberOfLines={8}
          onChangeText={setBody}
        />
        {images.length ? (
          <View style={styles.imageGrid}>
            {images.map((image) => (
              <Pressable key={image.id} style={styles.imageTile} onPress={() => removeImage(image.id)}>
                <Image source={{ uri: image.dataUrl }} style={styles.noteImage} />
                <View style={styles.imageRemove}>
                  <Text style={styles.imageRemoveText}>Remove</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.noteActions}>
          <Button mode="outlined" icon="image-plus" disabled={saving || images.length >= maxNoteImages} onPress={addImages}>
            Image
          </Button>
          <Button mode="contained" icon="content-save" loading={saving} onPress={save}>
            Save note
          </Button>
        </View>
      </AppCard>

      {visibleNotes.length ? (
        <AppCard style={styles.card}>
          <Text variant="titleMedium" style={styles.title}>
            Recent notes
          </Text>
          {visibleNotes.map((note) => {
            const noteImages = embeddedImagesFromBody(note.body);
            return (
              <View key={note.id} style={styles.noteItem}>
                <View style={styles.noteHeader}>
                  <View style={styles.noteText}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text style={styles.muted}>
                      {note.subject?.subjectName ?? "General"} - {note.noteType.replace("_", " ")}
                    </Text>
                  </View>
                  <View style={styles.noteButtons}>
                    <Button mode="text" compact icon="eye-outline" onPress={() => setViewingNote(note)}>
                      View
                    </Button>
                    <Button
                      mode="text"
                      compact
                      icon={confirmDeleteId === note.id ? "check" : "delete-outline"}
                      textColor={confirmDeleteId === note.id ? palette.secondary : palette.muted}
                      loading={deletingId === note.id}
                      onPress={() => removeNote(note.id)}
                    >
                      {confirmDeleteId === note.id ? "Confirm" : "Delete"}
                    </Button>
                  </View>
                </View>
                <Text numberOfLines={3} style={styles.preview}>
                  {bodyWithoutImages(note.body) || "Image note"}
                </Text>
                {noteImages.length ? (
                  <View style={styles.previewImages}>
                    {noteImages.slice(0, 3).map((image) => (
                      <Image key={image.id} source={{ uri: image.dataUrl }} style={styles.previewImage} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </AppCard>
      ) : null}

      <Portal>
        <Dialog visible={Boolean(viewingNote)} onDismiss={() => setViewingNote(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{viewingNote?.title}</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={styles.noteDialogScroll} contentContainerStyle={styles.noteDialogContent}>
              <Text style={styles.muted}>
                {viewingNote?.subject?.subjectName ?? "General"} - {viewingNote?.noteType.replace("_", " ")}
              </Text>
              <Text style={styles.fullNote}>{viewingNoteBody || "Image note"}</Text>
              {viewingNoteImages.length ? (
                <View style={styles.fullImageGrid}>
                  {viewingNoteImages.map((image) => (
                    <Image key={image.id} source={{ uri: image.dataUrl }} style={styles.fullImage} />
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setViewingNote(null)}>Close</Button>
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
  noteItem: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  noteText: {
    flex: 1,
    minWidth: 0
  },
  noteButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 2
  },
  noteActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  imageTile: {
    width: 118,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised
  },
  noteImage: {
    width: "100%",
    height: 82
  },
  imageRemove: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  imageRemoveText: {
    color: palette.secondary,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  noteTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  preview: {
    color: palette.muted,
    lineHeight: 19
  },
  previewImages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4
  },
  previewImage: {
    width: 92,
    height: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border
  },
  dialog: {
    backgroundColor: palette.surface
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  noteDialogScroll: {
    maxHeight: 460
  },
  noteDialogContent: {
    gap: 12
  },
  fullNote: {
    color: palette.text,
    lineHeight: 21
  },
  fullImageGrid: {
    gap: 12
  },
  fullImage: {
    width: "100%",
    height: 260,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    resizeMode: "contain",
    backgroundColor: palette.surfaceRaised
  },
  message: {
    color: palette.success,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
