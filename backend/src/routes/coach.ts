import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { limitAiUsage } from "../middleware/aiUsageLimit.js";
import {
  answerStudyQuestion,
  generateAdaptiveStudyPlan,
  generateClassNoteChunkFromTranscript,
  generateClassNotesFromTranscript,
  generateDailyInspiration,
  transcribeClassAudio,
  type ClassNoteDraft,
  type DailyInspiration
} from "../services/aiService.js";
import { addXp } from "../services/gamificationService.js";
import { contextSnippetForQuery, extractResourceText } from "../services/resourceService.js";
import { todayMelbourne } from "../utils/date.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const coachRouter = Router();
coachRouter.use(requireAuth);

type SubjectForPlan = {
  subjectName: string;
};

type SubjectLabel = {
  subjectName: string;
} | null;

type ReflectionForPlan = {
  classDate: Date;
  classSummary: string;
  understood: string;
  confused: string;
  nextAction: string | null;
  subject: SubjectLabel;
};

type EventForPlan = {
  id: string;
  eventDate: Date;
  eventType: string;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  recurrence: string;
  recurrenceUntil: Date | null;
  notificationMinutes: number;
  subject: SubjectLabel;
};

type SessionForPlan = {
  createdAt: Date;
  durationSeconds: number;
  notes: string | null;
  subject: SubjectLabel;
};

type NoteForPlan = {
  title: string;
  body: string;
  noteType?: string;
  tags?: unknown;
  subject: SubjectLabel;
};

type ResourceForPlan = {
  fileName: string;
  extractedText: string;
};

type ResourceForAsk = {
  fileName: string;
  sourceType: string;
  extractedText: string;
  subject: SubjectLabel;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 12
  }
});

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dailyInspirationCache = new Map<string, { inspiration: DailyInspiration; cachedAt: number }>();

const reflectionSchema = z.object({
  subjectId: z.string().uuid().optional().nullable(),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classSummary: z.string().min(2).max(4000),
  understood: z.string().min(1).max(4000),
  confused: z.string().min(1).max(4000),
  nextAction: z.string().max(1200).optional().nullable()
});

const noteSchema = z.object({
  subjectId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(6_000_000),
  noteType: z.enum(["general", "worked_example", "formula", "mistake_log"]).default("general"),
  tags: z.array(z.string().min(1).max(32)).default([])
});

const planSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  availableMinutes: z.coerce.number().int().min(15).max(360).default(90),
  horizonDays: z.coerce.number().int().min(3).max(90).default(28),
  priority: z.string().max(600).optional().nullable()
});

const askSchema = z.object({
  subjectId: z.string().uuid().optional().nullable(),
  question: z.string().min(2).max(6000),
  sessionMode: z.enum(["tutor_session"]).optional().nullable(),
  sessionTopic: z.string().max(180).optional().nullable(),
  sessionGoal: z.string().max(1200).optional().nullable(),
  sessionEventId: z.string().uuid().optional().nullable()
});

const supportedScreenshotTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const supportedAudioTypes = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "video/mp4",
  "video/webm"
]);

const notetakerSchema = z.object({
  subjectId: z.string().uuid(),
  classDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  consentAcknowledged: z
    .union([z.literal("true"), z.literal(true)])
    .transform(() => true)
    .optional()
});

const notetakerChunkSchema = z.object({
  subjectId: z.string().uuid(),
  transcript: z.string().min(8).max(8000),
  elapsedSeconds: z.coerce.number().int().min(0).max(36_000).optional().nullable(),
  chunkIndex: z.coerce.number().int().min(0).max(2000).optional().nullable(),
  classDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  consentAcknowledged: z
    .union([z.literal("true"), z.literal(true)])
    .transform(() => true)
    .optional()
});

const ensureSubject = async (userId: string, subjectId?: string | null) => {
  if (!subjectId) return null;
  const subject = await prisma.userSubject.findFirst({ where: { id: subjectId, userId } });
  if (!subject) throw new HttpError(404, "Subject not found");
  return subject;
};

const daysUntilDate = (fromDate: Date, toDate: Date) => {
  const from = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const to = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
const minutesBetween = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime || !endTime) return 0;
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return Math.max(0, endHours * 60 + endMinutes - (startHours * 60 + startMinutes));
};
const recurrenceMatches = (event: EventForPlan, day: Date) => {
  const eventDate = dateKey(event.eventDate);
  const dayKey = dateKey(day);
  if (dayKey < eventDate) return false;
  if (event.recurrenceUntil && dayKey > dateKey(event.recurrenceUntil)) return false;

  const diff = daysUntilDate(event.eventDate, day);
  if (event.recurrence === "WEEKLY") return diff % 7 === 0;
  if (event.recurrence === "FORTNIGHTLY_WEEK_1" || event.recurrence === "FORTNIGHTLY_WEEK_2") {
    return diff % 14 === 0;
  }
  return diff === 0;
};

const recurrenceLabel = (recurrence: string) => {
  if (recurrence === "WEEKLY") return "weekly";
  if (recurrence === "FORTNIGHTLY_WEEK_1") return "week 1 fortnightly";
  if (recurrence === "FORTNIGHTLY_WEEK_2") return "week 2 fortnightly";
  return "once";
};

const expandStudyBlocks = (events: EventForPlan[], start: Date, horizonDays: number) =>
  Array.from({ length: horizonDays }, (_, dayIndex) => addDays(start, dayIndex)).flatMap((day) =>
    events
      .filter((event) => recurrenceMatches(event, day))
      .map((event) => ({
        id: event.id,
        date: dateKey(day),
        title: event.title,
        subject: event.subject?.subjectName ?? "Flexible study",
        startTime: event.startTime ?? "00:00",
        endTime: event.endTime ?? "00:00",
        durationMinutes: minutesBetween(event.startTime, event.endTime),
        recurrence: event.recurrence,
        source: recurrenceLabel(event.recurrence)
      }))
  );

const resourceDto = (resource: {
  id: string;
  userId: string;
  subjectId: string | null;
  fileName: string;
  fileType: string;
  sourceType: string;
  extractedText: string;
  createdAt: Date;
  subject?: unknown;
}) => ({
  ...resource,
  extractedTextPreview: resource.extractedText.slice(0, 260),
  extractedText: undefined
});

const bullets = (items: string[]) => (items.length ? items.map((item) => `- ${item}`).join("\n") : "- Nothing flagged.");
const tagsAsArray = (tags: unknown): string[] =>
  Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];

const isMistakeNote = (note: NoteForPlan) => {
  const tags = tagsAsArray(note.tags);
  return note.noteType === "mistake_log" || tags.some((tag) => /mistake|weak|timer-check/i.test(tag));
};

const isTutorSessionNote = (note: NoteForPlan) => {
  const tags = tagsAsArray(note.tags);
  return tags.includes("tutor-session") || /^Tutor session:/i.test(note.title);
};

const compactText = (value: string, maxLength = 260) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const buildAskCoachLearningSignals = (reflections: ReflectionForPlan[], notes: NoteForPlan[]) => {
  const tutorSessionSignals = notes
    .filter(isTutorSessionNote)
    .slice(0, 5)
    .map((note) => `Previous tutor session in ${note.subject?.subjectName ?? "General"} (${note.title}): ${compactText(note.body, 360)}`);

  const confusionSignals = reflections
    .filter((reflection) => reflection.confused.trim())
    .slice(0, 3)
    .map(
      (reflection) =>
        `Confusion from ${reflection.subject?.subjectName ?? "General"}: ${compactText(reflection.confused, 220)}`
    );

  const mistakeSignals = notes
    .filter(isMistakeNote)
    .slice(0, 4)
    .map((note) => `Recent mistake in ${note.subject?.subjectName ?? "General"} (${note.title}): ${compactText(note.body)}`);

  const contextSignals = notes
    .filter((note) => !isMistakeNote(note))
    .slice(0, 3)
    .map((note) => `Recent note in ${note.subject?.subjectName ?? "General"} (${note.title}): ${compactText(note.body, 180)}`);

  return [...tutorSessionSignals, ...mistakeSignals, ...confusionSignals, ...contextSignals].slice(0, 10).join("\n");
};

const formatClassNoteBody = (draft: ClassNoteDraft, transcript: string) => {
  const body = [
    draft.summary,
    "",
    "Key points",
    bullets(draft.key_points),
    "",
    "Subject terms",
    bullets(draft.subject_terms),
    "",
    "Confusion flags",
    bullets(draft.confusion_flags),
    "",
    "Questions to ask",
    bullets(draft.questions_to_ask),
    "",
    "Closed-book prompts",
    bullets(draft.retrieval_prompts),
    "",
    "Next actions",
    bullets(draft.next_actions),
    "",
    "Transcript",
    transcript
  ].join("\n");

  return body.slice(0, 30_000);
};

coachRouter.get(
  "/daily-inspiration",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const today = todayMelbourne();
    const cacheKey = `${authReq.user.id}:${today}`;
    const cached = dailyInspirationCache.get(cacheKey);
    if (cached) {
      res.json({ inspiration: cached.inspiration });
      return;
    }

    const todayDate = dateOnly(today);
    const [user, subjects, events, sessions, gamification] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authReq.user.id },
        select: { displayName: true }
      }),
      prisma.userSubject.findMany({
        where: { userId: authReq.user.id },
        orderBy: { subjectName: "asc" }
      }),
      prisma.event.findMany({
        where: {
          userId: authReq.user.id,
          completed: false,
          eventType: { in: ["SAC", "SAT", "PRACTICE_SAC", "PRACTICE_SAT", "EXAM", "TASK"] },
          eventDate: { gte: todayDate }
        },
        include: { subject: true },
        orderBy: { eventDate: "asc" },
        take: 4
      }),
      prisma.studySession.findMany({
        where: { userId: authReq.user.id, createdAt: { gte: todayDate } },
        select: { durationSeconds: true }
      }),
      prisma.userGamification.findUnique({
        where: { userId: authReq.user.id }
      })
    ]);

    const inspiration = await generateDailyInspiration({
      date: today,
      displayName: user?.displayName,
      subjects: subjects.map((subject) => subject.subjectName),
      currentStreak: gamification?.currentStreak ?? 0,
      todayMinutes: Math.round(sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60),
      upcomingEvents: events.map((event: EventForPlan) => ({
        title: event.title,
        subject: event.subject?.subjectName ?? "General study",
        eventType: event.eventType,
        daysUntil: daysUntilDate(todayDate, event.eventDate)
      }))
    });

    dailyInspirationCache.set(cacheKey, { inspiration, cachedAt: Date.now() });
    for (const key of dailyInspirationCache.keys()) {
      if (!key.endsWith(`:${today}`)) dailyInspirationCache.delete(key);
    }

    res.json({ inspiration });
  })
);

coachRouter.get(
  "/reflections",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const reflections = await prisma.studyReflection.findMany({
      where: { userId: authReq.user.id },
      include: { subject: true },
      orderBy: { classDate: "desc" }
    });
    res.json({ reflections });
  })
);

coachRouter.post(
  "/reflections",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = reflectionSchema.parse(req.body);
    await ensureSubject(authReq.user.id, payload.subjectId);

    const reflection = await prisma.studyReflection.create({
      data: {
        userId: authReq.user.id,
        subjectId: payload.subjectId ?? null,
        classDate: dateOnly(payload.classDate),
        classSummary: payload.classSummary,
        understood: payload.understood,
        confused: payload.confused,
        nextAction: payload.nextAction
      },
      include: { subject: true }
    });

    res.status(201).json({ reflection });
  })
);

coachRouter.get(
  "/notes",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const notes = await prisma.studyNote.findMany({
      where: { userId: authReq.user.id },
      include: { subject: true },
      orderBy: { updatedAt: "desc" }
    });
    res.json({ notes });
  })
);

coachRouter.post(
  "/notes",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = noteSchema.parse(req.body);
    await ensureSubject(authReq.user.id, payload.subjectId);

    const note = await prisma.studyNote.create({
      data: {
        userId: authReq.user.id,
        subjectId: payload.subjectId ?? null,
        title: payload.title,
        body: payload.body,
        noteType: payload.noteType,
        tags: payload.tags
      },
      include: { subject: true }
    });

    res.status(201).json({ note });
  })
);

coachRouter.put(
  "/notes/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = noteSchema.partial().parse(req.body);
    const existing = await prisma.studyNote.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!existing) throw new HttpError(404, "Note not found");
    await ensureSubject(authReq.user.id, payload.subjectId);

    const note = await prisma.studyNote.update({
      where: { id: existing.id },
      data: payload,
      include: { subject: true }
    });
    res.json({ note });
  })
);

coachRouter.delete(
  "/notes/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.studyNote.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!existing) throw new HttpError(404, "Note not found");
    await prisma.studyNote.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

coachRouter.get(
  "/resources",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const resources = await prisma.studyResource.findMany({
      where: { userId: authReq.user.id },
      include: { subject: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ resources: resources.map(resourceDto) });
  })
);

coachRouter.post(
  "/resources/upload",
  upload.array("files", 12),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.length) throw new HttpError(400, "Upload at least one PDF, Word, Markdown or text file");

    const subjectId = typeof req.body.subjectId === "string" && req.body.subjectId ? req.body.subjectId : null;
    const sourceType =
      typeof req.body.sourceType === "string" &&
      ["textbook", "obsidian", "notes", "exam", "exam_report", "practice_sac", "practice_sat"].includes(
        req.body.sourceType
      )
        ? req.body.sourceType
        : "textbook";
    await ensureSubject(authReq.user.id, subjectId);

    const created = [];
    for (const file of files) {
      const extracted = await extractResourceText(file);
      if (!extracted.text) continue;
      const resource = await prisma.studyResource.create({
        data: {
          userId: authReq.user.id,
          subjectId,
          fileName: file.originalname,
          fileType: extracted.fileType,
          sourceType,
          extractedText: extracted.text
        },
        include: { subject: true }
      });
      created.push(resourceDto(resource));
    }

    res.status(201).json({ resources: created });
  })
);

coachRouter.get(
  "/resources/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const resource = await prisma.studyResource.findFirst({
      where: { id: req.params.id, userId: authReq.user.id },
      include: { subject: true }
    });
    if (!resource) throw new HttpError(404, "Resource not found");
    res.json({
      resource: {
        ...resource,
        extractedTextPreview: resource.extractedText.slice(0, 260)
      }
    });
  })
);

coachRouter.delete(
  "/resources/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.studyResource.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!existing) throw new HttpError(404, "Resource not found");
    await prisma.studyResource.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

coachRouter.post(
  "/notetaker/chunk",
  limitAiUsage(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = notetakerChunkSchema.parse(req.body);
    if (!payload.consentAcknowledged) {
      throw new HttpError(400, "Only record when your teacher and class allow it.");
    }

    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
    if (!subject) throw new HttpError(400, "Choose a subject before recording.");

    const subjectScope = { OR: [{ subjectId: subject.id }, { subjectId: null }] };
    const [reflections, notes] = await Promise.all([
      prisma.studyReflection.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { classDate: "desc" },
        take: 3
      }),
      prisma.studyNote.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { updatedAt: "desc" },
        take: 3
      })
    ]);

    const contextQuery = `${subject.subjectName} live class note`;
    const context = [
      ...reflections.map((reflection: ReflectionForPlan) =>
        contextSnippetForQuery(
          `${reflection.subject?.subjectName ?? "General"} reflection ${reflection.classDate.toISOString().slice(0, 10)}`,
          `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`,
          contextQuery,
          600
        )
      ),
      ...notes.map((note: NoteForPlan) =>
        contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, contextQuery, 700)
      )
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000);

    const chunk = await generateClassNoteChunkFromTranscript({
      subject: subject.subjectName,
      transcript: payload.transcript,
      context,
      elapsedSeconds: payload.elapsedSeconds ?? null,
      chunkIndex: payload.chunkIndex ?? null
    });

    res.json({
      chunk: {
        ...chunk,
        elapsedSeconds: payload.elapsedSeconds ?? 0,
        chunkIndex: payload.chunkIndex ?? 0
      }
    });
  })
);

coachRouter.post(
  "/notetaker",
  upload.single("audio"),
  limitAiUsage({ cost: 8 }),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = notetakerSchema.parse(req.body);
    if (!payload.consentAcknowledged) {
      throw new HttpError(400, "Only record when your teacher and class allow it.");
    }

    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
    if (!subject) throw new HttpError(400, "Choose a subject before recording.");

    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new HttpError(400, "Upload a class audio recording.");
    const mimeType = file.mimetype.toLowerCase().split(";")[0];
    if (!supportedAudioTypes.has(mimeType)) {
      throw new HttpError(400, "Audio must be WEBM, MP4, MP3, M4A, OGG, WAV or FLAC.");
    }
    if (!file.size) throw new HttpError(400, "The recording was empty.");

    const subjectScope = { OR: [{ subjectId: subject.id }, { subjectId: null }] };
    const [reflections, notes, resources] = await Promise.all([
      prisma.studyReflection.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { classDate: "desc" },
        take: 6
      }),
      prisma.studyNote.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { updatedAt: "desc" },
        take: 8
      }),
      prisma.studyResource.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 6
      })
    ]);

    const contextQuery = `${subject.subjectName} class lesson notes study design assessment`;
    const context = [
      ...reflections.map((reflection: ReflectionForPlan) =>
        contextSnippetForQuery(
          `${reflection.subject?.subjectName ?? "General"} reflection ${reflection.classDate.toISOString().slice(0, 10)}`,
          `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`,
          contextQuery,
          800
        )
      ),
      ...notes.map((note: NoteForPlan) =>
        contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, contextQuery, 900)
      ),
      ...resources.map((resource: ResourceForAsk) =>
        contextSnippetForQuery(
          `${resource.subject?.subjectName ?? "General"} ${resource.sourceType}: ${resource.fileName}`,
          resource.extractedText,
          contextQuery,
          1200
        )
      )
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12_000);

    const transcript = await transcribeClassAudio({
      subject: subject.subjectName,
      context,
      audio: {
        buffer: file.buffer,
        mimeType,
        fileName: file.originalname || `class-audio-${Date.now()}.webm`
      }
    });

    if (!transcript.trim()) {
      throw new HttpError(422, "I could not hear enough speech to make useful notes.");
    }

    const classNotes = await generateClassNotesFromTranscript({
      subject: subject.subjectName,
      transcript: transcript.slice(0, 40_000),
      context,
      classDate: payload.classDate ?? null
    });

    const note = await prisma.studyNote.create({
      data: {
        userId: authReq.user.id,
        subjectId: subject.id,
        title: classNotes.title.slice(0, 140),
        body: formatClassNoteBody(classNotes, transcript),
        noteType: "general",
        tags: ["class-notetaker", "ai-generated"]
      },
      include: { subject: true }
    });

    const gamification = await addXp(authReq.user.id, 12);
    res.status(201).json({ note, transcript, classNotes, gamification });
  })
);

coachRouter.post(
  "/ask",
  upload.array("screenshots", 4),
  limitAiUsage({ cost: (req) => (((req.files ?? []) as Express.Multer.File[]).length ? 3 : 1) }),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = askSchema.parse(req.body);
    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
    const sessionEvent = payload.sessionEventId
      ? await prisma.event.findFirst({ where: { id: payload.sessionEventId, userId: authReq.user.id } })
      : null;
    if (payload.sessionEventId && !sessionEvent) throw new HttpError(404, "Tutor session booking not found");
    const files = ((req.files ?? []) as Express.Multer.File[]).filter(Boolean);

    for (const file of files) {
      if (!supportedScreenshotTypes.has(file.mimetype)) {
        throw new HttpError(400, "Screenshots must be PNG, JPEG, WEBP or GIF images.");
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new HttpError(400, "Each screenshot must be smaller than 8MB.");
      }
    }

    const subjectScope = subject ? { OR: [{ subjectId: subject.id }, { subjectId: null }] } : {};
    const [reflections, notes, resources] = await Promise.all([
      prisma.studyReflection.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { classDate: "desc" },
        take: 6
      }),
      prisma.studyNote.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { updatedAt: "desc" },
        take: payload.sessionMode === "tutor_session" ? 18 : 8
      }),
      prisma.studyResource.findMany({
        where: { userId: authReq.user.id, ...subjectScope },
        include: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    ]);

    const sourceLabels = [
      ...notes.map((note: NoteForPlan) => `${note.subject?.subjectName ?? "General"} note: ${note.title}`),
      ...resources.map(
        (resource: ResourceForAsk) =>
          `${resource.subject?.subjectName ?? "General"} ${resource.sourceType}: ${resource.fileName}`
      )
    ];

    const context = [
      ...reflections.map((reflection: ReflectionForPlan) =>
        contextSnippetForQuery(
          `${reflection.subject?.subjectName ?? "General"} reflection ${reflection.classDate.toISOString().slice(0, 10)}`,
          `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`,
          payload.question,
          900
        )
      ),
      ...notes.map((note: NoteForPlan) =>
        contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, payload.question, 1200)
      ),
      ...resources.map((resource: ResourceForAsk) =>
        contextSnippetForQuery(
          `${resource.subject?.subjectName ?? "General"} ${resource.sourceType}: ${resource.fileName}`,
          resource.extractedText,
          payload.question,
          1800
        )
      )
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 16_000);

    const answer = await answerStudyQuestion({
      subject: subject?.subjectName,
      subjectUnit: subject?.unit,
      question: payload.question,
      context,
      learningSignals: buildAskCoachLearningSignals(reflections, notes),
      sessionMode: payload.sessionMode ?? null,
      sessionTopic: payload.sessionTopic ?? null,
      sessionGoal: payload.sessionGoal ?? null,
      sessionEventTitle: sessionEvent?.title ?? null,
      sourceLabels,
      screenshots: files.map((file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        base64: file.buffer.toString("base64")
      }))
    });

    const gamification = await addXp(authReq.user.id, files.length ? 8 : 5);
    res.json({ answer, gamification });
  })
);

coachRouter.get(
  "/plans/latest",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const plan = await prisma.adaptiveStudyPlan.findFirst({
      where: { userId: authReq.user.id },
      orderBy: { createdAt: "desc" }
    });
    res.json({ plan });
  })
);

coachRouter.post(
  "/plans/generate",
  limitAiUsage({ cost: 4 }),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const payload = planSchema.parse(req.body);
    const today = dateOnly(payload.planDate);
    const horizonDays = payload.horizonDays;

    const horizonEnd = addDays(today, horizonDays);
    const [subjects, reflections, events, sessions, notes, resources] = await Promise.all([
      prisma.userSubject.findMany({ where: { userId: authReq.user.id }, orderBy: { subjectName: "asc" } }),
      prisma.studyReflection.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { classDate: "desc" },
        take: 14
      }),
      prisma.event.findMany({
        where: {
          userId: authReq.user.id,
          completed: false,
          OR: [
            { eventType: { in: ["SAC", "SAT", "PRACTICE_SAC", "PRACTICE_SAT", "EXAM", "TASK"] }, eventDate: { gte: today } },
            {
              eventType: "STUDY_TIME",
              eventDate: { lte: horizonEnd },
              OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: today } }]
            }
          ]
        },
        include: { subject: true },
        orderBy: { eventDate: "asc" },
        take: 80
      }),
      prisma.studySession.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 10
      }),
      prisma.studyNote.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { updatedAt: "desc" },
        take: 16
      }),
      prisma.studyResource.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { createdAt: "desc" },
        take: 12
      })
    ]);

    const assessmentEvents = events.filter((event: EventForPlan) => event.eventType !== "STUDY_TIME");
    const studyTimeEvents = events.filter((event: EventForPlan) => event.eventType === "STUDY_TIME");
    const studyBlocks = expandStudyBlocks(studyTimeEvents, today, horizonDays);
    const eventQuery = assessmentEvents
      .map((event: EventForPlan) => `${event.subject?.subjectName ?? ""} ${event.title} ${event.description ?? ""}`)
      .join(" ");
    const planEvents = assessmentEvents.map((event: EventForPlan) => ({
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      subject: event.subject?.subjectName ?? "No subject",
      topic: event.description?.trim() ? `${event.title}: ${event.description.trim()}` : event.title,
      description: event.description,
      daysUntil: daysUntilDate(today, event.eventDate)
    }));
    const sourceEvents = [
      ...planEvents.map((event) => ({
        id: event.id,
        title: event.title,
        subject: event.subject,
        event_type: event.eventType,
        event_date: event.eventDate,
        topic: event.topic,
        days_until: event.daysUntil
      })),
      ...studyTimeEvents.map((event) => ({
        id: event.id,
        title: event.title,
        subject: event.subject?.subjectName ?? "Flexible study",
        event_type: "STUDY_TIME",
        event_date: `${event.eventDate.toISOString().slice(0, 10)} ${event.startTime ?? ""}-${event.endTime ?? ""}`,
        topic: recurrenceLabel(event.recurrence),
        days_until: daysUntilDate(today, event.eventDate)
      }))
    ];

    const plan = await generateAdaptiveStudyPlan({
      planDate: payload.planDate,
      availableMinutes: payload.availableMinutes,
      horizonDays,
      priority: payload.priority,
      subjects: subjects.map((subject: SubjectForPlan) => subject.subjectName),
      events: planEvents,
      studyBlocks,
      recentReflections: reflections
        .map(
          (reflection: ReflectionForPlan) =>
            `${reflection.classDate.toISOString().slice(0, 10)} ${reflection.subject?.subjectName ?? "General"}\nClass: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`
        )
        .join("\n\n"),
      upcomingEvents: assessmentEvents
        .map(
          (event: EventForPlan) =>
            `${event.eventDate.toISOString().slice(0, 10)} ${event.eventType}: ${event.title} (${event.subject?.subjectName ?? "No subject"}) ${event.description ?? ""}`
        )
        .join("\n"),
      scheduledStudyBlocks: studyBlocks
        .map(
          (block) =>
            `${block.date} ${block.startTime}-${block.endTime} ${block.subject} ${block.title} (${block.source}, ${block.durationMinutes}min)`
        )
        .join("\n"),
      recentSessions: sessions
        .map(
          (session: SessionForPlan) =>
            `${session.createdAt.toISOString().slice(0, 10)} ${session.subject?.subjectName ?? "No subject"} ${Math.round(session.durationSeconds / 60)}min ${session.notes ?? ""}`
        )
        .join("\n"),
      notesContext: notes
        .map((note: NoteForPlan) =>
          contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, eventQuery, 900)
        )
        .join("\n\n"),
      resourceContext: resources
        .map((resource: ResourceForPlan) => contextSnippetForQuery(`${resource.fileName}`, resource.extractedText, eventQuery, 1200))
        .join("\n\n")
    });

    const savedPlan = await prisma.adaptiveStudyPlan.create({
      data: {
        userId: authReq.user.id,
        planDate: today,
        summary: plan.summary,
        focusAreas: plan.focus_areas,
        tasks: plan.tasks,
        dailyPlan: plan.daily_plan,
        subjectRoadmaps: plan.subject_roadmaps,
        sourceEvents,
        checkpoints: plan.checkpoints
      }
    });

    res.status(201).json({ plan: savedPlan });
  })
);
