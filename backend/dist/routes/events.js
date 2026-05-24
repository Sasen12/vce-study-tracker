import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prismaClient.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { addXp, awardEventBadges } from "../services/gamificationService.js";
import { recordStudentMemory } from "../services/studentMemoryService.js";
export const eventsRouter = Router();
eventsRouter.use(requireAuth);
const eventSchema = z.object({
    subjectId: z.string().uuid().optional().nullable(),
    title: z.string().min(2),
    eventType: z.enum(["SAC", "SAT", "PRACTICE_SAC", "PRACTICE_SAT", "EXAM", "TASK", "STUDY_TIME"]),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    recurrence: z.enum(["NONE", "WEEKLY", "FORTNIGHTLY_WEEK_1", "FORTNIGHTLY_WEEK_2"]).default("NONE"),
    recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    notificationMinutes: z.coerce.number().int().min(0).max(1440).default(60),
    source: z.string().max(40).default("manual"),
    googleCalendarId: z.string().max(200).optional().nullable(),
    googleEventId: z.string().max(200).optional().nullable(),
    description: z.string().max(1000).optional().nullable()
});
const eventPatchSchema = z.object({
    subjectId: z.string().uuid().optional().nullable(),
    title: z.string().min(2).optional(),
    eventType: z.enum(["SAC", "SAT", "PRACTICE_SAC", "PRACTICE_SAT", "EXAM", "TASK", "STUDY_TIME"]).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    recurrence: z.enum(["NONE", "WEEKLY", "FORTNIGHTLY_WEEK_1", "FORTNIGHTLY_WEEK_2"]).optional(),
    recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    notificationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
    source: z.string().max(40).optional(),
    googleCalendarId: z.string().max(200).optional().nullable(),
    googleEventId: z.string().max(200).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    completed: z.boolean().optional()
});
const dateOnly = (date) => new Date(`${date}T00:00:00.000Z`);
const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};
const validateEventPayload = (payload) => {
    if (payload.eventType === "STUDY_TIME") {
        if (!payload.startTime || !payload.endTime) {
            throw new HttpError(400, "Study times need a start and end time.");
        }
        if (timeToMinutes(payload.endTime) <= timeToMinutes(payload.startTime)) {
            throw new HttpError(400, "Study time end must be after the start time.");
        }
        return;
    }
    if (!payload.subjectId) {
        throw new HttpError(400, "Assessments need a subject.");
    }
};
eventsRouter.get("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const events = await prisma.event.findMany({
        where: { userId: authReq.user.id },
        include: { subject: true },
        orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }]
    });
    res.json({ events });
}));
eventsRouter.post("/", asyncHandler(async (req, res) => {
    const authReq = req;
    const payload = eventSchema.parse(req.body);
    validateEventPayload(payload);
    const subject = payload.subjectId
        ? await prisma.userSubject.findFirst({
            where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
        })
        : null;
    if (payload.subjectId && !subject)
        throw new HttpError(404, "Subject not found");
    const event = await prisma.event.create({
        data: {
            userId: authReq.user.id,
            subjectId: subject?.id ?? null,
            title: payload.title,
            eventType: payload.eventType,
            eventDate: dateOnly(payload.eventDate),
            startTime: payload.startTime,
            endTime: payload.endTime,
            recurrence: payload.recurrence,
            recurrenceUntil: payload.recurrenceUntil ? dateOnly(payload.recurrenceUntil) : null,
            notificationMinutes: payload.notificationMinutes,
            source: payload.source,
            googleCalendarId: payload.googleCalendarId,
            googleEventId: payload.googleEventId,
            description: payload.description
        },
        include: { subject: true }
    });
    await addXp(authReq.user.id, 5);
    const gamification = await awardEventBadges(authReq.user.id);
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: subject?.id ?? null,
        subjectName: subject?.subjectName ?? "General study",
        eventType: "calendar_event_created",
        sourceType: "calendar_event",
        sourceId: event.id,
        title: event.title,
        summary: `${event.eventType} logged for ${event.eventDate.toISOString().slice(0, 10)}.${event.description ? ` ${event.description}` : ""}`,
        importance: event.eventType === "EXAM" || event.eventType === "SAC" || event.eventType === "SAT" ? 4 : 2,
        payload: {
            eventType: event.eventType,
            eventDate: event.eventDate.toISOString().slice(0, 10),
            startTime: event.startTime,
            endTime: event.endTime,
            recurrence: event.recurrence,
            description: event.description
        }
    }, {
        topic: event.description ?? event.title,
        signals: event.eventType === "STUDY_TIME"
            ? [
                {
                    signalType: "study_behavior",
                    topic: event.title,
                    title: "Scheduled study time",
                    detail: `Scheduled ${event.title} on ${event.eventDate.toISOString().slice(0, 10)}.`,
                    evidence: `${event.startTime ?? ""}-${event.endTime ?? ""}`.trim() || "Calendar study block created.",
                    nextAction: "Use this block for the weakest linked topic when the date arrives.",
                    weight: 2
                }
            ]
            : [
                {
                    signalType: "assessment_risk",
                    topic: event.description ?? event.title,
                    title: `${event.eventType} coming up`,
                    detail: `${event.title} is now part of the student's assessment timeline.`,
                    evidence: `${event.eventType} on ${event.eventDate.toISOString().slice(0, 10)}`,
                    nextAction: "Link saved mistakes and recent weak topics to this assessment in the next study plan.",
                    weight: event.eventType === "EXAM" ? 5 : 4
                }
            ]
    });
    res.status(201).json({ event, gamification });
}));
eventsRouter.patch("/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const current = await prisma.event.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!current)
        throw new HttpError(404, "Event not found");
    const payload = eventPatchSchema.parse(req.body);
    validateEventPayload({
        subjectId: payload.subjectId ?? current.subjectId,
        title: payload.title ?? current.title,
        eventType: payload.eventType ??
            current.eventType,
        eventDate: payload.eventDate ?? current.eventDate.toISOString().slice(0, 10),
        startTime: payload.startTime === undefined ? current.startTime : payload.startTime,
        endTime: payload.endTime === undefined ? current.endTime : payload.endTime,
        recurrence: payload.recurrence ?? current.recurrence,
        recurrenceUntil: payload.recurrenceUntil === undefined
            ? current.recurrenceUntil?.toISOString().slice(0, 10) ?? null
            : payload.recurrenceUntil,
        notificationMinutes: payload.notificationMinutes ?? current.notificationMinutes,
        source: payload.source ?? current.source,
        googleCalendarId: payload.googleCalendarId === undefined ? current.googleCalendarId : payload.googleCalendarId,
        googleEventId: payload.googleEventId === undefined ? current.googleEventId : payload.googleEventId,
        description: payload.description === undefined ? current.description : payload.description
    });
    if (payload.subjectId) {
        const subject = await prisma.userSubject.findFirst({
            where: { id: payload.subjectId, userId: authReq.user.id, archivedAt: null }
        });
        if (!subject)
            throw new HttpError(404, "Subject not found");
    }
    const event = await prisma.event.update({
        where: { id: current.id },
        data: {
            subjectId: payload.subjectId,
            title: payload.title,
            eventType: payload.eventType,
            eventDate: payload.eventDate ? dateOnly(payload.eventDate) : undefined,
            startTime: payload.startTime,
            endTime: payload.endTime,
            recurrence: payload.recurrence,
            recurrenceUntil: payload.recurrenceUntil === undefined ? undefined : payload.recurrenceUntil ? dateOnly(payload.recurrenceUntil) : null,
            notificationMinutes: payload.notificationMinutes,
            source: payload.source,
            googleCalendarId: payload.googleCalendarId,
            googleEventId: payload.googleEventId,
            description: payload.description,
            completed: payload.completed
        },
        include: { subject: true }
    });
    const gamification = await awardEventBadges(authReq.user.id);
    await recordStudentMemory({
        userId: authReq.user.id,
        subjectId: event.subjectId,
        subjectName: event.subject?.subjectName ?? "General study",
        eventType: "calendar_event_updated",
        sourceType: "calendar_event",
        sourceId: event.id,
        title: event.title,
        summary: `${event.eventType} updated for ${event.eventDate.toISOString().slice(0, 10)}.${event.completed ? " Marked completed." : ""}`,
        importance: event.completed ? 2 : event.eventType === "EXAM" || event.eventType === "SAC" || event.eventType === "SAT" ? 4 : 2,
        payload: {
            eventType: event.eventType,
            eventDate: event.eventDate.toISOString().slice(0, 10),
            completed: event.completed,
            description: event.description
        }
    }, {
        topic: event.description ?? event.title,
        signals: event.completed
            ? [
                {
                    signalType: "study_behavior",
                    topic: event.title,
                    title: "Assessment/calendar item completed",
                    detail: `${event.title} was marked complete.`,
                    evidence: `${event.eventType} completion update`,
                    nextAction: "Capture marks or teacher feedback if available so the memory map can calibrate outcomes.",
                    weight: 2
                }
            ]
            : [
                {
                    signalType: event.eventType === "STUDY_TIME" ? "study_behavior" : "assessment_risk",
                    topic: event.description ?? event.title,
                    title: `${event.eventType} timeline changed`,
                    detail: `${event.title} is scheduled for ${event.eventDate.toISOString().slice(0, 10)}.`,
                    evidence: "Calendar event was updated.",
                    nextAction: "Refresh the study plan so risk and next tasks use the latest date.",
                    weight: event.eventType === "EXAM" ? 5 : 3
                }
            ]
    });
    res.json({ event, gamification });
}));
eventsRouter.delete("/:id", asyncHandler(async (req, res) => {
    const authReq = req;
    const event = await prisma.event.findFirst({ where: { id: req.params.id, userId: authReq.user.id } });
    if (!event)
        throw new HttpError(404, "Event not found");
    await prisma.event.delete({ where: { id: event.id } });
    res.status(204).send();
}));
