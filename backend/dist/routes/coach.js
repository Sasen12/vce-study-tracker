import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { limitAiUsage } from "../middleware/aiUsageLimit.js";
import { answerStudyQuestion, generateAdaptiveStudyPlan, generateClassNoteChunkFromTranscript, generateClassNotesFromTranscript, generateDailyInspiration, transcribeClassAudio } from "../services/aiService.js";
import { addXp } from "../services/gamificationService.js";
import { contextSnippetForQuery, extractResourceText } from "../services/resourceService.js";
import { recordStudentMemory, subjectKeyFor } from "../services/studentMemoryService.js";
import { todayMelbourne } from "../utils/date.js";
import { asyncHandler, HttpError } from "../utils/http.js";
export const coachRouter = Router();
coachRouter.use(requireAuth);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024,
        files: 12
    }
});
const dateOnly = (value) => new Date(`${value}T00:00:00.000Z`);
const dailyInspirationCache = new Map();
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
    responseMode: z.enum(["direct", "tutor"]).default("direct"),
    coachChatTitle: z.string().max(180).optional().nullable(),
    coachChatTranscript: z.string().max(30_000).optional().nullable(),
    sessionMode: z.enum(["tutor_session"]).optional().nullable(),
    sessionTopic: z.string().max(180).optional().nullable(),
    sessionGoal: z.string().max(1200).optional().nullable(),
    sessionEventId: z.string().uuid().optional().nullable()
});
const supportedScreenshotTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const supportedTutorPdfTypes = new Set(["application/pdf", "application/x-pdf"]);
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
const uploadedFilesFrom = (files) => {
    if (Array.isArray(files))
        return files.filter(Boolean);
    if (files && typeof files === "object") {
        return Object.values(files)
            .flat()
            .filter(Boolean);
    }
    return [];
};
const normalizedMimeType = (file) => file.mimetype.toLowerCase().split(";")[0];
const isTutorPdfFile = (file) => supportedTutorPdfTypes.has(normalizedMimeType(file)) || file.originalname.toLowerCase().endsWith(".pdf");
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
const ensureSubject = async (userId, subjectId) => {
    if (!subjectId)
        return null;
    const subject = await prisma.userSubject.findFirst({ where: { id: subjectId, userId } });
    if (!subject)
        throw new HttpError(404, "Subject not found");
    return subject;
};
const daysUntilDate = (fromDate, toDate) => {
    const from = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    const to = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
};
const dateKey = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};
const minutesBetween = (startTime, endTime) => {
    if (!startTime || !endTime)
        return 0;
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    return Math.max(0, endHours * 60 + endMinutes - (startHours * 60 + startMinutes));
};
const recurrenceMatches = (event, day) => {
    const eventDate = dateKey(event.eventDate);
    const dayKey = dateKey(day);
    if (dayKey < eventDate)
        return false;
    if (event.recurrenceUntil && dayKey > dateKey(event.recurrenceUntil))
        return false;
    const diff = daysUntilDate(event.eventDate, day);
    if (event.recurrence === "WEEKLY")
        return diff % 7 === 0;
    if (event.recurrence === "FORTNIGHTLY_WEEK_1" || event.recurrence === "FORTNIGHTLY_WEEK_2") {
        return diff % 14 === 0;
    }
    return diff === 0;
};
const recurrenceLabel = (recurrence) => {
    if (recurrence === "WEEKLY")
        return "weekly";
    if (recurrence === "FORTNIGHTLY_WEEK_1")
        return "week 1 fortnightly";
    if (recurrence === "FORTNIGHTLY_WEEK_2")
        return "week 2 fortnightly";
    return "once";
};
const expandStudyBlocks = (events, start, horizonDays) => Array.from({ length: horizonDays }, (_, dayIndex) => addDays(start, dayIndex)).flatMap((day) => events
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
})));
const resourceDto = (resource) => ({
    ...resource,
    extractedTextPreview: resource.extractedText.slice(0, 260),
    extractedText: undefined
});
const bullets = (items) => (items.length ? items.map((item) => `- ${item}`).join("\n") : "- Nothing flagged.");
const tagsAsArray = (tags) => Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string") : [];
const isMistakeNote = (note) => {
    const tags = tagsAsArray(note.tags);
    return note.noteType === "mistake_log" || tags.some((tag) => /mistake|weak|timer-check/i.test(tag));
};
const isTutorSessionNote = (note) => {
    const tags = tagsAsArray(note.tags);
    return tags.includes("tutor-session") || /^Tutor session:/i.test(note.title);
};
const compactText = (value, maxLength = 260) => value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
const buildAskCoachLearningSignals = (reflections, notes) => {
    const tutorSessionSignals = notes
        .filter(isTutorSessionNote)
        .slice(0, 5)
        .map((note) => `Previous tutor session in ${note.subject?.subjectName ?? "General"} (${note.title}): ${compactText(note.body, 360)}`);
    const confusionSignals = reflections
        .filter((reflection) => reflection.confused.trim())
        .slice(0, 3)
        .map((reflection) => `Confusion from ${reflection.subject?.subjectName ?? "General"}: ${compactText(reflection.confused, 220)}`);
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
const buildStudentMemorySignals = (subjectMemory, learningSignals) => {
    const memoryMapSignal = subjectMemory
        ? `Student map risk: ${subjectMemory.riskLevel}. Predicted next task: ${subjectMemory.predictedNextTask ?? "Not enough evidence yet"}. Weak areas: ${compactText(JSON.stringify(subjectMemory.weakAreas), 420)}. Strengths: ${compactText(JSON.stringify(subjectMemory.strengths), 300)}. Recent topics: ${compactText(JSON.stringify(subjectMemory.recentTopics), 300)}.`
        : "";
    const recentSignals = learningSignals
        .slice(0, 8)
        .map((signal) => `${signal.signalType} in ${signal.topic ?? "General"}: ${compactText(signal.title, 120)} - ${compactText(signal.detail, 220)} Evidence: ${compactText(signal.evidence, 160)}${signal.nextAction ? ` Next: ${compactText(signal.nextAction, 160)}` : ""}`);
    return [memoryMapSignal, ...recentSignals].filter(Boolean).join("\n");
};
const buildStudentMemoryPlanContext = (subjectMemories) => subjectMemories
    .slice(0, 8)
    .map((memory) => `### ${memory.subjectName}
Risk: ${memory.riskLevel}
Predicted next task: ${memory.predictedNextTask ?? "Not enough evidence yet"}
Weak areas: ${compactText(JSON.stringify(memory.weakAreas), 600)}
Common mistakes: ${compactText(JSON.stringify(memory.commonMistakes), 520)}
Strengths: ${compactText(JSON.stringify(memory.strengths), 420)}
Recent topics: ${compactText(JSON.stringify(memory.recentTopics), 420)}
Evidence trail: ${compactText(JSON.stringify(memory.evidenceTrail), 520)}`)
    .join("\n\n");
const formatClassNoteBody = (draft, transcript) => {
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
coachRouter.get("/daily-inspiration", asyncHandler(async (req, res) => {
    const authReq = req;
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
        upcomingEvents: events.map((event) => ({
            title: event.title,
            subject: event.subject?.subjectName ?? "General study",
            eventType: event.eventType,
            daysUntil: daysUntilDate(todayDate, event.eventDate)
        }))
    });
    dailyInspirationCache.set(cacheKey, { inspiration, cachedAt: Date.now() });
    for (const key of dailyInspirationCache.keys()) {
        if (!key.endsWith(`:${today}`))
            dailyInspirationCache.delete(key);
    }
    res.json({ inspiration });
}));
coachRouter.get("/reflections", asyncHandler(async (req, res) => {
    const authReq = req;
    const reflections = await prisma.studyReflection.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { classDate: "desc" }
    });
    res.json({ reflections });
}));
coachRouter.post("/reflections", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = reflectionSchema.parse(req.body);
    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
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
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject?.id ?? null,
        subjectName: subject?.subjectName ?? "General study",
        eventType: "class_reflection_saved",
        sourceType: "study_reflection",
        sourceId: reflection.id,
        title: `Class reflection: ${subject?.subjectName ?? "General study"}`,
        summary: `Class: ${payload.classSummary}\nUnderstood: ${payload.understood}\nConfused: ${payload.confused}\nNext: ${payload.nextAction ?? ""}`,
        importance: payload.confused.trim() ? 3 : 2,
        payload: {
            classDate: payload.classDate,
            classSummary: payload.classSummary,
            understood: payload.understood,
            confused: payload.confused,
            nextAction: payload.nextAction
        }
    }, {
        topic: payload.classSummary,
        signals: [
            ...(payload.understood.trim()
                ? [
                    {
                        signalType: "strength",
                        topic: payload.classSummary,
                        title: "Understood in class",
                        detail: payload.understood,
                        evidence: "Student marked this as understood in a class reflection.",
                        nextAction: "Use this as retrieval practice before moving to harder application.",
                        weight: 2
                    }
                ]
                : []),
            ...(payload.confused.trim()
                ? [
                    {
                        signalType: "weakness",
                        topic: payload.classSummary,
                        title: "Confusion from class",
                        detail: payload.confused,
                        evidence: "Student explicitly logged this as confusing.",
                        nextAction: payload.nextAction ?? "Ask Coach for a worked explanation, then do one checked question.",
                        weight: 4
                    }
                ]
                : [])
        ]
    });
    res.status(201).json({ reflection });
}));
coachRouter.get("/notes", asyncHandler(async (req, res) => {
    const authReq = req;
    const notes = await prisma.studyNote.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { updatedAt: "desc" }
    });
    res.json({ notes });
}));
coachRouter.post("/notes", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = noteSchema.parse(req.body);
    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
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
    const mistake = payload.noteType === "mistake_log" || payload.tags.some((tag) => /mistake|weak|error|timer-check/i.test(tag));
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject?.id ?? null,
        subjectName: subject?.subjectName ?? "General study",
        eventType: mistake ? "mistake_saved" : "study_note_saved",
        sourceType: "study_note",
        sourceId: note.id,
        title: note.title,
        summary: compactText(note.body, 2000),
        importance: mistake ? 4 : 2,
        payload: {
            title: note.title,
            noteType: note.noteType,
            tags: note.tags,
            bodyPreview: compactText(note.body, 1800)
        }
    }, {
        topic: note.title,
        extractAiSignals: mistake,
        evidence: note.body,
        signals: [
            {
                signalType: mistake ? "mistake" : "resource_context",
                topic: note.title.replace(/^Mistake:\s*/i, ""),
                title: mistake ? "Saved mistake" : "Saved study note",
                detail: compactText(note.body, 700),
                evidence: mistake ? "Student saved this as a mistake log." : "Student saved this note as study context.",
                nextAction: mistake
                    ? "Turn this mistake into one flashcard and one checked retry."
                    : "Use this note as source context for the next Coach question or practice set.",
                weight: mistake ? 4 : 2
            }
        ]
    });
    res.status(201).json({ note });
}));
coachRouter.put("/notes/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = noteSchema.partial().parse(req.body);
    const existing = await prisma.studyNote.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!existing)
        throw new HttpError(404, "Note not found");
    await ensureSubject(authReq.user.id, payload.subjectId);
    const note = await prisma.studyNote.update({
        where: { id: existing.id },
        data: payload,
        include: { subject: true }
    });
    res.json({ note });
}));
coachRouter.delete("/notes/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const existing = await prisma.studyNote.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!existing)
        throw new HttpError(404, "Note not found");
    await prisma.studyNote.delete({ where: { id: existing.id } });
    res.status(204).send();
}));
coachRouter.get("/resources", asyncHandler(async (req, res) => {
    const authReq = req;
    const resources = await prisma.studyResource.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: { createdAt: "desc" }
    });
    res.json({ resources: resources.map(resourceDto) });
}));
coachRouter.post("/resources/upload", upload.array("files", 12), asyncHandler(async (req, res) => {
    const authReq = req;
    const files = (req.files ?? []);
    if (!files.length)
        throw new HttpError(400, "Upload at least one PDF, Word, Markdown or text file");
    const subjectId = typeof req.body.subjectId === "string" && req.body.subjectId ? req.body.subjectId : null;
    const sourceType = typeof req.body.sourceType === "string" &&
        ["textbook", "obsidian", "notes", "exam", "exam_report", "practice_sac", "practice_sat"].includes(req.body.sourceType)
        ? req.body.sourceType
        : "textbook";
    await ensureSubject(authReq.user.id, subjectId);
    const created = [];
    for (const file of files) {
        const extracted = await extractResourceText(file);
        if (!extracted.text)
            continue;
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
        await recordStudentMemory({
            userId: authReq.user.id,
            subjectId,
            subjectName: resource.subject?.subjectName ?? "General study",
            eventType: "resource_uploaded",
            sourceType: "study_resource",
            sourceId: resource.id,
            title: resource.fileName,
            summary: `Uploaded ${resource.sourceType} resource (${resource.fileType}) with ${resource.extractedText.length} extracted characters.`,
            importance: ["exam", "exam_report", "practice_sac", "practice_sat"].includes(resource.sourceType) ? 4 : 3,
            payload: {
                fileName: resource.fileName,
                fileType: resource.fileType,
                sourceType: resource.sourceType,
                extractedTextPreview: compactText(resource.extractedText, 1800)
            }
        }, {
            topic: resource.fileName,
            signals: [
                {
                    signalType: "resource_context",
                    topic: resource.fileName,
                    title: `${resource.sourceType} uploaded`,
                    detail: `The student uploaded ${resource.fileName}, making it searchable context for future coaching and practice.`,
                    evidence: compactText(resource.extractedText, 420),
                    nextAction: "Use this source when generating questions or answering Coach prompts for the linked subject.",
                    weight: ["exam", "exam_report", "practice_sac", "practice_sat"].includes(resource.sourceType) ? 4 : 3
                }
            ]
        });
    }
    res.status(201).json({ resources: created });
}));
coachRouter.get("/resources/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const resource = await prisma.studyResource.findFirst({
        where: { id: req.params.id, userId: authReq.user.id },
        include: { subject: true }
    });
    if (!resource)
        throw new HttpError(404, "Resource not found");
    res.json({
        resource: {
            ...resource,
            extractedTextPreview: resource.extractedText.slice(0, 260)
        }
    });
}));
coachRouter.delete("/resources/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const existing = await prisma.studyResource.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!existing)
        throw new HttpError(404, "Resource not found");
    await prisma.studyResource.delete({ where: { id: existing.id } });
    res.status(204).send();
}));
coachRouter.post("/notetaker/chunk", limitAiUsage(), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = notetakerChunkSchema.parse(req.body);
    if (!payload.consentAcknowledged) {
        throw new HttpError(400, "Only record when your teacher and class allow it.");
    }
    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
    if (!subject)
        throw new HttpError(400, "Choose a subject before recording.");
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
        ...reflections.map((reflection) => contextSnippetForQuery(`${reflection.subject?.subjectName ?? "General"} reflection ${reflection.classDate.toISOString().slice(0, 10)}`, `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`, contextQuery, 600)),
        ...notes.map((note) => contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, contextQuery, 700))
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
}));
coachRouter.post("/notetaker", upload.single("audio"), limitAiUsage({ cost: 8 }), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = notetakerSchema.parse(req.body);
    if (!payload.consentAcknowledged) {
        throw new HttpError(400, "Only record when your teacher and class allow it.");
    }
    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
    if (!subject)
        throw new HttpError(400, "Choose a subject before recording.");
    const file = req.file;
    if (!file)
        throw new HttpError(400, "Upload a class audio recording.");
    const mimeType = file.mimetype.toLowerCase().split(";")[0];
    if (!supportedAudioTypes.has(mimeType)) {
        throw new HttpError(400, "Audio must be WEBM, MP4, MP3, M4A, OGG, WAV or FLAC.");
    }
    if (!file.size)
        throw new HttpError(400, "The recording was empty.");
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
        ...reflections.map((reflection) => contextSnippetForQuery(`${reflection.subject?.subjectName ?? "General"} reflection ${reflection.classDate.toISOString().slice(0, 10)}`, `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`, contextQuery, 800)),
        ...notes.map((note) => contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, contextQuery, 900)),
        ...resources.map((resource) => contextSnippetForQuery(`${resource.subject?.subjectName ?? "General"} ${resource.sourceType}: ${resource.fileName}`, resource.extractedText, contextQuery, 1200))
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
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject.id,
        subjectName: subject.subjectName,
        eventType: "class_notetaker_saved",
        sourceType: "study_note",
        sourceId: note.id,
        title: note.title,
        summary: `Class notetaker generated notes for ${subject.subjectName}. ${classNotes.summary}`,
        importance: classNotes.confusion_flags.length ? 4 : 3,
        payload: {
            title: note.title,
            summary: classNotes.summary,
            keyPoints: classNotes.key_points,
            confusionFlags: classNotes.confusion_flags,
            nextActions: classNotes.next_actions
        }
    }, {
        topic: note.title,
        signals: [
            ...classNotes.confusion_flags.map((flag) => ({
                signalType: "weakness",
                topic: note.title,
                title: "Class confusion flag",
                detail: flag,
                evidence: "Generated from class notetaker transcript.",
                nextAction: classNotes.next_actions[0] ?? "Turn this into a checked practice question.",
                weight: 4
            })),
            ...classNotes.key_points.slice(0, 2).map((point) => ({
                signalType: "topic_interest",
                topic: note.title,
                title: "Class topic captured",
                detail: point,
                evidence: "Generated from class notetaker transcript.",
                nextAction: classNotes.retrieval_prompts[0] ?? "Review with closed-book retrieval.",
                weight: 2
            }))
        ]
    });
    res.status(201).json({ note, transcript, classNotes, gamification });
}));
coachRouter.post("/ask", upload.fields([
    { name: "attachments", maxCount: 6 },
    { name: "screenshots", maxCount: 4 }
]), limitAiUsage({
    cost: (req) => {
        const files = uploadedFilesFrom(req.files);
        if (files.some(isTutorPdfFile))
            return 4;
        return files.length ? 3 : 1;
    }
}), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = askSchema.parse(req.body);
    const subject = await ensureSubject(authReq.user.id, payload.subjectId);
    const sessionEvent = payload.sessionEventId
        ? await prisma.event.findFirst({ where: { id: payload.sessionEventId, userId: authReq.user.id } })
        : null;
    if (payload.sessionEventId && !sessionEvent)
        throw new HttpError(404, "Tutor session booking not found");
    const files = uploadedFilesFrom(req.files);
    const imageFiles = [];
    const documentFiles = [];
    for (const file of files) {
        const mimeType = normalizedMimeType(file);
        if (supportedScreenshotTypes.has(mimeType)) {
            if (file.size > 8 * 1024 * 1024) {
                throw new HttpError(400, "Each image must be smaller than 8MB.");
            }
            imageFiles.push(file);
            continue;
        }
        if (isTutorPdfFile(file)) {
            if (file.size > 25 * 1024 * 1024) {
                throw new HttpError(400, "Each PDF must be smaller than 25MB.");
            }
            documentFiles.push(file);
            continue;
        }
        throw new HttpError(400, "Tutor attachments must be PNG, JPEG, WEBP, GIF or PDF files.");
    }
    const subjectScope = subject ? { OR: [{ subjectId: subject.id }, { subjectId: null }] } : {};
    const currentSubjectKey = subjectKeyFor(subject?.id ?? null, subject?.subjectName ?? null);
    const [attachedDocuments, reflections, notes, resources, recentMemorySignals, subjectMemory] = await Promise.all([
        Promise.all(documentFiles.map(async (file) => {
            const extracted = await extractResourceText(file);
            if (!extracted.text.trim()) {
                throw new HttpError(422, `I could not read text from ${file.originalname || "that PDF"}. Try a text-based PDF.`);
            }
            return {
                fileName: file.originalname || `attached-pdf-${Date.now()}.pdf`,
                fileType: extracted.fileType,
                text: extracted.text
            };
        })),
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
            take: payload.sessionMode === "tutor_session" || payload.responseMode === "tutor" ? 18 : 8
        }),
        prisma.studyResource.findMany({
            where: { userId: authReq.user.id, ...subjectScope },
            include: { subject: true },
            orderBy: { createdAt: "desc" },
            take: 8
        }),
        prisma.learningSignal.findMany({
            where: { userId: authReq.user.id, subjectKey: currentSubjectKey },
            orderBy: { createdAt: "desc" },
            take: 12
        }),
        prisma.studentSubjectMemory.findUnique({
            where: { userId_subjectKey: { userId: authReq.user.id, subjectKey: currentSubjectKey } }
        })
    ]);
    const attachedDocumentLabels = attachedDocuments.map((document) => `Attached PDF: ${document.fileName}`);
    const sourceLabels = [
        ...attachedDocumentLabels,
        ...notes.map((note) => `${note.subject?.subjectName ?? "General"} note: ${note.title}`),
        ...resources.map((resource) => `${resource.subject?.subjectName ?? "General"} ${resource.sourceType}: ${resource.fileName}`)
    ];
    const context = [
        ...attachedDocuments.map((document) => contextSnippetForQuery(`Attached PDF: ${document.fileName}`, document.text, payload.question, 4500)),
        ...reflections.map((reflection) => contextSnippetForQuery(`${reflection.subject?.subjectName ?? "General"} reflection ${reflection.classDate.toISOString().slice(0, 10)}`, `Class: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`, payload.question, 900)),
        ...notes.map((note) => contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, payload.question, 1200)),
        ...resources.map((resource) => contextSnippetForQuery(`${resource.subject?.subjectName ?? "General"} ${resource.sourceType}: ${resource.fileName}`, resource.extractedText, payload.question, 1800))
    ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 24_000);
    const answer = await answerStudyQuestion({
        subject: subject?.subjectName,
        subjectUnit: subject?.unit,
        question: payload.question,
        context,
        learningSignals: [buildStudentMemorySignals(subjectMemory, recentMemorySignals), buildAskCoachLearningSignals(reflections, notes)]
            .filter(Boolean)
            .join("\n"),
        responseMode: payload.sessionMode === "tutor_session" ? "tutor" : payload.responseMode,
        coachChatTitle: payload.coachChatTitle ?? null,
        coachChatTranscript: payload.coachChatTranscript ?? null,
        sessionMode: payload.sessionMode ?? null,
        sessionTopic: payload.sessionTopic ?? null,
        sessionGoal: payload.sessionGoal ?? null,
        sessionEventTitle: sessionEvent?.title ?? null,
        attachedDocumentLabels,
        sourceLabels,
        screenshots: imageFiles.map((file) => ({
            fileName: file.originalname,
            mimeType: normalizedMimeType(file),
            base64: file.buffer.toString("base64")
        }))
    });
    const gamification = await addXp(authReq.user.id, files.length ? 8 : 5);
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject?.id ?? null,
        subjectName: subject?.subjectName ?? "General study",
        eventType: payload.sessionMode === "tutor_session" ? "tutor_turn_asked" : "coach_question_asked",
        sourceType: "ask_coach",
        title: payload.question,
        summary: `Student asked: ${payload.question}\nCoach answered: ${answer.answer}`,
        importance: payload.sessionMode === "tutor_session" || files.length ? 4 : 3,
        payload: {
            question: payload.question,
            responseMode: payload.responseMode,
            sessionMode: payload.sessionMode,
            sessionTopic: payload.sessionTopic,
            answerConfidence: answer.confidence,
            tutorDiagnosis: answer.tutor_plan?.diagnosis,
            tutorNextRevision: answer.tutor_plan?.next_revision,
            keyPoints: answer.key_points,
            followUpQuestions: answer.follow_up_questions,
            attachedDocumentLabels,
            sourceLabels
        }
    }, {
        topic: payload.sessionTopic ?? payload.question,
        evidence: answer.tutor_plan?.diagnosis ?? answer.answer,
        extractAiSignals: true,
        signals: [
            {
                signalType: "topic_interest",
                topic: payload.sessionTopic ?? payload.question,
                title: payload.sessionMode === "tutor_session" ? "Tutor turn topic" : "Coach question topic",
                detail: compactText(payload.question, 700),
                evidence: `Asked Coach in ${answer.confidence} confidence mode.${attachedDocumentLabels.length ? ` Attachments: ${attachedDocumentLabels.join(", ")}` : ""}`,
                nextAction: answer.tutor_plan?.next_revision ?? answer.follow_up_questions[0] ?? null,
                weight: payload.sessionMode === "tutor_session" ? 4 : 3
            },
            ...(answer.tutor_plan?.diagnosis
                ? [
                    {
                        signalType: "weakness",
                        topic: payload.sessionTopic ?? payload.question,
                        title: "Coach diagnosis",
                        detail: answer.tutor_plan.diagnosis,
                        evidence: "Extracted from the Coach tutor plan for this turn.",
                        nextAction: answer.tutor_plan.next_revision,
                        weight: 4
                    }
                ]
                : [])
        ]
    });
    res.json({ answer, gamification });
}));
coachRouter.get("/plans/latest", asyncHandler(async (req, res) => {
    const authReq = req;
    const plan = await prisma.adaptiveStudyPlan.findFirst({
        where: { userId: authReq.user.id },
        orderBy: { createdAt: "desc" }
    });
    res.json({ plan });
}));
coachRouter.post("/plans/generate", limitAiUsage({ cost: 4 }), asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = planSchema.parse(req.body);
    const today = dateOnly(payload.planDate);
    const horizonDays = payload.horizonDays;
    const horizonEnd = addDays(today, horizonDays);
    const [subjects, reflections, events, sessions, notes, resources, subjectMemories] = await Promise.all([
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
        }),
        prisma.studentSubjectMemory.findMany({
            where: { userId: authReq.user.id },
            orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }],
            take: 12
        })
    ]);
    const assessmentEvents = events.filter((event) => event.eventType !== "STUDY_TIME");
    const studyTimeEvents = events.filter((event) => event.eventType === "STUDY_TIME");
    const studyBlocks = expandStudyBlocks(studyTimeEvents, today, horizonDays);
    const eventQuery = assessmentEvents
        .map((event) => `${event.subject?.subjectName ?? ""} ${event.title} ${event.description ?? ""}`)
        .join(" ");
    const planEvents = assessmentEvents.map((event) => ({
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
        subjects: subjects.map((subject) => subject.subjectName),
        events: planEvents,
        studyBlocks,
        recentReflections: reflections
            .map((reflection) => `${reflection.classDate.toISOString().slice(0, 10)} ${reflection.subject?.subjectName ?? "General"}\nClass: ${reflection.classSummary}\nUnderstood: ${reflection.understood}\nConfused: ${reflection.confused}\nNext: ${reflection.nextAction ?? ""}`)
            .join("\n\n"),
        upcomingEvents: assessmentEvents
            .map((event) => `${event.eventDate.toISOString().slice(0, 10)} ${event.eventType}: ${event.title} (${event.subject?.subjectName ?? "No subject"}) ${event.description ?? ""}`)
            .join("\n"),
        scheduledStudyBlocks: studyBlocks
            .map((block) => `${block.date} ${block.startTime}-${block.endTime} ${block.subject} ${block.title} (${block.source}, ${block.durationMinutes}min)`)
            .join("\n"),
        recentSessions: sessions
            .map((session) => `${session.createdAt.toISOString().slice(0, 10)} ${session.subject?.subjectName ?? "No subject"} ${Math.round(session.durationSeconds / 60)}min ${session.notes ?? ""}`)
            .join("\n"),
        studentMemoryContext: buildStudentMemoryPlanContext(subjectMemories),
        notesContext: notes
            .map((note) => contextSnippetForQuery(`${note.subject?.subjectName ?? "General"} note: ${note.title}`, note.body, eventQuery, 900))
            .join("\n\n"),
        resourceContext: resources
            .map((resource) => contextSnippetForQuery(`${resource.fileName}`, resource.extractedText, eventQuery, 1200))
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
    await recordStudentMemory({
        userId: authReq.user.id,
        eventType: "adaptive_plan_generated",
        sourceType: "adaptive_study_plan",
        sourceId: savedPlan.id,
        title: "Adaptive study plan generated",
        summary: `${plan.summary}\nFocus areas: ${plan.focus_areas.join(", ")}`,
        importance: 3,
        payload: {
            planDate: payload.planDate,
            availableMinutes: payload.availableMinutes,
            horizonDays,
            focusAreas: plan.focus_areas,
            checkpoints: plan.checkpoints,
            taskCount: plan.tasks.length
        }
    }, {
        topic: plan.focus_areas[0] ?? "Study plan",
        signals: plan.focus_areas.slice(0, 4).map((focus) => ({
            signalType: "next_action",
            topic: focus,
            title: "Plan focus area",
            detail: focus,
            evidence: "Generated by the adaptive study plan from current calendar and memory data.",
            nextAction: plan.tasks.find((task) => task.topic === focus || task.title.includes(focus))?.title ?? plan.tasks[0]?.title ?? null,
            weight: 3
        }))
    });
    res.status(201).json({ plan: savedPlan });
}));
