import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Text } from "react-native-paper";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";
import type { ClassNoteChunk, ClassNoteDraft, StudyNote, UserSubject } from "@/types";

type ClassNotetakerPanelProps = {
  selectedSubject: UserSubject | null;
};

type LastClassNote = {
  note: StudyNote;
  classNotes: ClassNoteDraft;
};

type LiveMoment = {
  id: string;
  time: string;
  text: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type BrowserSpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
};

const getSpeechRecognition = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const speechWindow = window as BrowserSpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

const localDateKey = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const safeFilePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
};

const liveMomentText = (text: string) => {
  const clean = text.replace(/\s+/g, " ").trim();
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] ?? clean;
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 177)}...` : firstSentence;
};

const CHUNK_INTERVAL_MS = 45_000;
const MIN_CHUNK_WORDS = 35;
const MIN_FINAL_CHUNK_WORDS = 8;

export function ClassNotetakerPanel({ selectedSubject }: ClassNotetakerPanelProps) {
  const createClassNote = useAppStore((state) => state.createClassNote);
  const createClassNoteChunk = useAppStore((state) => state.createClassNoteChunk);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [chunking, setChunking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [lastNote, setLastNote] = useState<LastClassNote | null>(null);
  const [liveMoments, setLiveMoments] = useState<LiveMoment[]>([]);
  const [chunkCards, setChunkCards] = useState<ClassNoteChunk[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingChunkTextRef = useRef("");
  const chunkIndexRef = useRef(0);
  const chunkingRef = useRef(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechShouldRunRef = useRef(false);
  const elapsedRef = useRef(0);

  const canRecord =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";
  const canPreviewSpeech = canRecord && Boolean(getSpeechRecognition());

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopSpeechPreview = () => {
    speechShouldRunRef.current = false;
    const recognition = speechRecognitionRef.current;
    speechRecognitionRef.current = null;
    if (!recognition) return;

    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // Some browsers throw if recognition has already ended.
      }
    }
  };

  const startSpeechPreview = () => {
    const Recognition = getSpeechRecognition();
    setLiveMoments([]);
    setInterimTranscript("");
    if (!Recognition) return false;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";
    speechShouldRunRef.current = true;
    speechRecognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      const finalMoment = liveMomentText(finalText);
      if (finalMoment) {
        pendingChunkTextRef.current = `${pendingChunkTextRef.current} ${finalText}`.trim();
        setLiveMoments((current) => {
          if (current[0]?.text === finalMoment) return current;
          return [
            {
              id: `${Date.now()}-${current.length}`,
              time: formatDuration(elapsedRef.current),
              text: finalMoment
            },
            ...current
          ].slice(0, 4);
        });
      }
      setInterimTranscript(interimText.replace(/\s+/g, " ").trim());
    };

    recognition.onerror = () => {
      setInterimTranscript("");
    };

    recognition.onend = () => {
      if (!speechShouldRunRef.current || typeof window === "undefined") return;
      window.setTimeout(() => {
        if (!speechShouldRunRef.current) return;
        try {
          recognition.start();
        } catch {
          speechShouldRunRef.current = false;
        }
      }, 350);
    };

    try {
      recognition.start();
      return true;
    } catch {
      speechShouldRunRef.current = false;
      speechRecognitionRef.current = null;
      return false;
    }
  };

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const flushClassChunk = useCallback(
    async (force = false) => {
      if (!selectedSubject || chunkingRef.current) return;
      const transcript = pendingChunkTextRef.current.replace(/\s+/g, " ").trim();
      const words = transcript.split(/\s+/).filter(Boolean).length;
      if (!transcript || words < (force ? MIN_FINAL_CHUNK_WORDS : MIN_CHUNK_WORDS)) return;

      pendingChunkTextRef.current = "";
      chunkingRef.current = true;
      setChunking(true);
      try {
        const chunk = await createClassNoteChunk({
          subjectId: selectedSubject.id,
          transcript,
          elapsedSeconds: elapsedRef.current,
          chunkIndex: chunkIndexRef.current,
          classDate: localDateKey(),
          consentAcknowledged: true
        });
        chunkIndexRef.current += 1;
        setChunkCards((current) => [chunk, ...current].slice(0, 5));
      } catch {
        pendingChunkTextRef.current = `${transcript} ${pendingChunkTextRef.current}`.trim();
      } finally {
        chunkingRef.current = false;
        setChunking(false);
      }
    },
    [createClassNoteChunk, selectedSubject]
  );

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!recording || !canPreviewSpeech) return undefined;
    const timer = window.setInterval(() => {
      void flushClassChunk(false);
    }, CHUNK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [canPreviewSpeech, flushClassChunk, recording]);

  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      stopSpeechPreview();
      stopStream();
    },
    []
  );

  const saveRecording = async (blob: Blob, mimeType: string, subject: UserSubject) => {
    if (blob.size < 1000) {
      setMessage("I did not catch enough audio to make notes.");
      return;
    }

    const formData = new FormData();
    const fileType = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    formData.append("subjectId", subject.id);
    formData.append("classDate", localDateKey());
    formData.append("consentAcknowledged", "true");
    formData.append("audio", blob, `class-${safeFilePart(subject.subjectName)}-${Date.now()}.${fileType}`);

    const result = await createClassNote(formData);
    setLastNote({ note: result.note, classNotes: result.classNotes });
    setMessage("Class notes saved.");
  };

  const startRecording = async () => {
    if (!selectedSubject) {
      setMessage("Choose a subject first.");
      return;
    }
    if (!permissionChecked) {
      setMessage("Confirm recording is allowed first.");
      return;
    }
    if (!canRecord) {
      setMessage("Microphone recording is available in the web app.");
      return;
    }

    setMessage(null);
    setLastNote(null);
    setLiveMoments([]);
    setChunkCards([]);
    setInterimTranscript("");
    pendingChunkTextRef.current = "";
    chunkIndexRef.current = 0;
    setElapsedSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setRecording(false);
        setProcessing(false);
        stopSpeechPreview();
        stopStream();
        setMessage("Recording stopped unexpectedly.");
      };

      recorder.onstop = async () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: recordedMimeType });
        setRecording(false);
        setProcessing(true);
        stopSpeechPreview();
        stopStream();
        try {
          await saveRecording(audioBlob, recordedMimeType, selectedSubject);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not make class notes yet.");
        } finally {
          setProcessing(false);
          chunksRef.current = [];
        }
      };

      recorder.start(1500);
      const previewStarted = startSpeechPreview();
      setRecording(true);
      if (!previewStarted) {
        setMessage("Recording started. Live preview is not available in this browser.");
      }
    } catch (error) {
      stopSpeechPreview();
      stopStream();
      setRecording(false);
      setMessage(error instanceof Error ? error.message : "Could not access the microphone.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      setMessage("Turning the lesson into notes...");
      void flushClassChunk(true);
      stopSpeechPreview();
      recorderRef.current.stop();
    }
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="microphone-outline" size={24} color={palette.primary} />
        </View>
        <View style={styles.headerText}>
          <Text variant="titleLarge" style={styles.title}>
            AI class notetaker
          </Text>
          <Text style={styles.muted}>{selectedSubject?.subjectName ?? "Choose a subject"}</Text>
        </View>
        <View style={[styles.statusBadge, recording && styles.statusRecording, processing && styles.statusProcessing]}>
          <Text style={styles.statusText}>{recording ? formatDuration(elapsedSeconds) : processing ? "thinking" : "ready"}</Text>
        </View>
      </View>

      <View style={styles.permissionRow}>
        <Button
          mode={permissionChecked ? "contained-tonal" : "outlined"}
          icon={permissionChecked ? "check-circle" : "shield-check-outline"}
          compact
          onPress={() => setPermissionChecked((value) => !value)}
          disabled={recording || processing}
        >
          Allowed to record
        </Button>
        <Text style={styles.permissionText}>Only record when your teacher and class allow it.</Text>
      </View>

      <View style={styles.recorderStrip}>
        <View style={[styles.recordDot, recording && styles.recordDotActive]} />
        <View style={styles.recorderCopy}>
          <Text style={styles.recorderTitle}>{recording ? "Listening now" : processing ? "Building class notes" : "Ready for class"}</Text>
          <Text style={styles.muted}>
            {lastNote ? lastNote.classNotes.summary : "Transcript, key terms, confusions and recall prompts save into Notes."}
          </Text>
        </View>
      </View>

      {(recording || chunkCards.length > 0 || liveMoments.length > 0 || interimTranscript) ? (
        <View style={styles.livePanel}>
          <View style={styles.liveHeader}>
            <View style={styles.liveTitleRow}>
              <MaterialCommunityIcons name="text-recognition" size={18} color={palette.info} />
              <Text style={styles.liveTitle}>Chunked notes</Text>
            </View>
            <Text style={styles.liveBadge}>{chunking ? "writing..." : canPreviewSpeech ? "every 45s" : "after stop"}</Text>
          </View>

          {chunkCards.length ? (
            <View style={styles.chunkList}>
              {chunkCards.map((card) => (
                <View key={`${card.chunkIndex}-${card.elapsedSeconds}-${card.title}`} style={styles.chunkCard}>
                  <View style={styles.chunkHeader}>
                    <Text style={styles.liveTime}>{formatDuration(card.elapsedSeconds)}</Text>
                    <Text style={styles.chunkTitle}>{card.title}</Text>
                    <Text style={[styles.confidenceText, card.confidence === "high" && styles.confidenceHighText]}>
                      {card.confidence}
                    </Text>
                  </View>
                  <Text style={styles.chunkSummary}>{card.summary}</Text>
                  {card.bullets.slice(0, 3).map((bullet, index) => (
                    <Text key={`${card.chunkIndex}-${bullet}-${index}`} style={styles.chunkBullet}>
                      - {bullet}
                    </Text>
                  ))}
                  <Text style={styles.chunkAction}>{card.action}</Text>
                </View>
              ))}
            </View>
          ) : liveMoments.length ? (
            <View style={styles.liveList}>
              {liveMoments.map((moment) => (
                <View key={moment.id} style={styles.liveMoment}>
                  <Text style={styles.liveTime}>{moment.time}</Text>
                  <Text style={styles.liveText}>{moment.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.liveEmpty}>
              {canPreviewSpeech
                ? "Short AI note cards will appear while class is still going."
                : "Saved notes will appear after the recording is processed."}
            </Text>
          )}

          {interimTranscript ? (
            <View style={styles.interimRow}>
              <Text numberOfLines={2} style={styles.interimText}>
                {interimTranscript}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {lastNote ? (
        <View style={styles.savedBlock}>
          <Text style={styles.savedTitle}>{lastNote.note.title}</Text>
          {lastNote.classNotes.next_actions.slice(0, 2).map((action, index) => (
            <Text key={`${action}-${index}`} style={styles.savedLine}>
              {index + 1}. {action}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {recording ? (
          <Button mode="contained" icon="stop-circle-outline" onPress={stopRecording}>
            Stop
          </Button>
        ) : (
          <Button mode="contained" icon="record-circle-outline" loading={processing} disabled={processing} onPress={startRecording}>
            Start recording
          </Button>
        )}
      </View>

      {message ? <Text style={[styles.message, message.includes("saved") && styles.successMessage]}>{message}</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${palette.primary}55`,
    backgroundColor: `${palette.primary}16`
  },
  headerText: {
    flex: 1
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  statusBadge: {
    minWidth: 76,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: 10
  },
  statusRecording: {
    borderColor: `${palette.secondary}77`,
    backgroundColor: `${palette.secondary}18`
  },
  statusProcessing: {
    borderColor: `${palette.info}77`,
    backgroundColor: `${palette.info}18`
  },
  statusText: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 12
  },
  permissionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10
  },
  permissionText: {
    flex: 1,
    minWidth: 220,
    color: palette.muted,
    lineHeight: 19
  },
  recorderStrip: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.primary}35`,
    backgroundColor: palette.surfaceRaised,
    padding: 14
  },
  recordDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.muted
  },
  recordDotActive: {
    backgroundColor: palette.secondary
  },
  recorderCopy: {
    flex: 1,
    gap: 3
  },
  recorderTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  livePanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${palette.info}35`,
    backgroundColor: `${palette.info}0F`,
    padding: 12
  },
  liveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  liveTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  liveTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  liveBadge: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  chunkList: {
    gap: 10
  },
  chunkCard: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 10
  },
  chunkHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  chunkTitle: {
    flex: 1,
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  confidenceText: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  confidenceHighText: {
    color: palette.success
  },
  chunkSummary: {
    color: palette.text,
    lineHeight: 20
  },
  chunkBullet: {
    color: palette.muted,
    lineHeight: 19
  },
  chunkAction: {
    color: palette.success,
    lineHeight: 20,
    fontFamily: "Outfit_700Bold"
  },
  liveList: {
    gap: 8
  },
  liveMoment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 8
  },
  liveTime: {
    minWidth: 42,
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  liveText: {
    flex: 1,
    color: palette.text,
    lineHeight: 20
  },
  liveEmpty: {
    color: palette.muted,
    lineHeight: 20
  },
  interimRow: {
    borderRadius: 8,
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  interimText: {
    color: palette.muted,
    fontStyle: "italic",
    lineHeight: 19
  },
  savedBlock: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  savedTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  savedLine: {
    color: palette.muted,
    lineHeight: 20
  },
  actions: {
    alignItems: "flex-end"
  },
  message: {
    color: palette.warning,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  },
  successMessage: {
    color: palette.success
  }
});
