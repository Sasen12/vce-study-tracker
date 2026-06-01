import { prisma } from "../db/prismaClient.js";
import { extractLearningSignalsFromMemoryEvent } from "./aiService.js";
import { inferVceSubjectFromQuestion } from "../resources/subjectInference.js";
import { normaliseSubjectName } from "../resources/vceSubjectCatalogue.js";
import { todayMelbourne, toDateOnly } from "../utils/date.js";
const assessmentEventTypes = ["SAC", "SAT", "PRACTICE_SAC", "PRACTICE_SAT", "EXAM", "TASK"];
const weaknessTypes = new Set(["weakness", "mistake", "assessment_risk"]);
const signalTypes = new Set([
    "weakness",
    "strength",
    "mistake",
    "topic_interest",
    "study_behavior",
    "assessment_risk",
    "resource_context",
    "next_action"
]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const compact = (value, maxLength = 600) => (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
const slug = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
export const subjectKeyFor = (subjectId, subjectName) => subjectId ?? (subjectName?.trim() ? `name:${slug(subjectName)}` : "general");
const sameSubjectName = (left, right) => {
    if (!left || !right)
        return false;
    return normaliseSubjectName(left) === normaliseSubjectName(right);
};
const joinSignalText = (parts) => parts
    .filter((value) => Boolean(value && value.trim()))
    .join("\n");
const signalSubjectText = (signal, fallbackSummary) => joinSignalText([
    signal.subjectName,
    signal.topic,
    signal.title,
    signal.detail,
    signal.evidence,
    signal.nextAction,
    fallbackSummary
]);
const signalContentText = (signal, fallbackSummary) => joinSignalText([
    signal.topic,
    signal.title,
    signal.detail,
    signal.evidence,
    signal.nextAction,
    fallbackSummary
]);
const inferSubjectForSignal = (signal, fallbackSummary) => inferVceSubjectFromQuestion(signalContentText(signal, fallbackSummary)) ??
    inferVceSubjectFromQuestion(signalSubjectText(signal, fallbackSummary));
const resolveSubjectTarget = async (userId, target) => {
    if (target.subjectId) {
        const subject = await prisma.userSubject.findFirst({
            where: { id: target.subjectId, userId },
            select: { id: true, subjectName: true }
        });
        if (subject) {
            return {
                subjectId: subject.id,
                subjectName: subject.subjectName,
                subjectKey: subjectKeyFor(subject.id, subject.subjectName)
            };
        }
    }
    if (target.subjectName?.trim()) {
        const subjects = await prisma.userSubject.findMany({
            where: { userId, archivedAt: null },
            select: { id: true, subjectName: true }
        });
        const matchedSubject = subjects.find((subject) => sameSubjectName(subject.subjectName, target.subjectName));
        if (matchedSubject) {
            return {
                subjectId: matchedSubject.id,
                subjectName: matchedSubject.subjectName,
                subjectKey: subjectKeyFor(matchedSubject.id, matchedSubject.subjectName)
            };
        }
    }
    return {
        subjectId: null,
        subjectName: target.subjectName?.trim() || "General study",
        subjectKey: target.subjectKey ?? subjectKeyFor(null, target.subjectName)
    };
};
const normalizeSignalType = (value) => signalTypes.has(value) ? value : "topic_interest";
const uniqueBy = (items, keyFor) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = keyFor(item);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
};
const daysUntil = (from, to) => {
    const fromDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    const toDay = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    return Math.max(0, Math.ceil((toDay.getTime() - fromDay.getTime()) / 86_400_000));
};
const aggregateSignals = (signals, includedTypes, limit = 5) => {
    const buckets = new Map();
    for (const signal of signals) {
        if (!includedTypes.has(signal.signalType))
            continue;
        const topic = compact(signal.topic || signal.title, 120) || "General";
        const key = topic.toLowerCase();
        const existing = buckets.get(key);
        if (!existing) {
            buckets.set(key, {
                topic,
                title: signal.title,
                detail: signal.detail,
                evidence: signal.evidence,
                confidence: signal.confidence,
                count: 1,
                weight: signal.weight,
                lastSeenAt: signal.createdAt,
                sourceTypes: new Set([signal.sourceType])
            });
            continue;
        }
        existing.count += 1;
        existing.weight += signal.weight;
        existing.sourceTypes.add(signal.sourceType);
        if (signal.createdAt > existing.lastSeenAt) {
            existing.title = signal.title;
            existing.detail = signal.detail;
            existing.evidence = signal.evidence;
            existing.confidence = signal.confidence;
            existing.lastSeenAt = signal.createdAt;
        }
    }
    return [...buckets.values()]
        .sort((a, b) => b.weight + b.count * 2 - (a.weight + a.count * 2))
        .slice(0, limit)
        .map((item) => ({
        topic: item.topic,
        title: item.title,
        detail: item.detail,
        evidence: item.evidence,
        confidence: item.confidence,
        count: item.count,
        weight: item.weight,
        sourceTypes: [...item.sourceTypes],
        lastSeenAt: item.lastSeenAt.toISOString()
    }));
};
const recentTopicSummary = (signals) => {
    const buckets = new Map();
    for (const signal of signals) {
        const topic = compact(signal.topic || signal.title, 120);
        if (!topic)
            continue;
        const key = topic.toLowerCase();
        const existing = buckets.get(key);
        if (!existing) {
            buckets.set(key, {
                topic,
                count: 1,
                weight: signal.weight,
                evidence: signal.evidence,
                lastSeenAt: signal.createdAt
            });
            continue;
        }
        existing.count += 1;
        existing.weight += signal.weight;
        if (signal.createdAt > existing.lastSeenAt) {
            existing.evidence = signal.evidence;
            existing.lastSeenAt = signal.createdAt;
        }
    }
    return [...buckets.values()]
        .sort((a, b) => b.count + b.weight - (a.count + a.weight))
        .slice(0, 8)
        .map((topic) => ({
        ...topic,
        lastSeenAt: topic.lastSeenAt.toISOString()
    }));
};
const studyMethodSummary = (signals) => uniqueBy(signals
    .filter((signal) => signal.nextAction)
    .sort((a, b) => b.weight - a.weight)
    .map((signal) => ({
    method: signal.nextAction,
    reason: signal.title,
    topic: signal.topic,
    evidence: signal.evidence,
    confidence: signal.confidence
})), (item) => item.method.toLowerCase()).slice(0, 6);
const predictedTaskFor = (weakAreas, recentTopics, upcomingAssessments, riskLevel) => {
    const weakness = weakAreas[0];
    const assessment = upcomingAssessments[0];
    const urgentPrefix = riskLevel === "high" ? "20 min timed response" : "15 min repair drill";
    if (weakness && assessment) {
        return `${urgentPrefix} on ${weakness.topic} for ${assessment.title}, then save the missed criterion as a mistake rule.`;
    }
    if (weakness) {
        return `Repair ${weakness.topic}: write one improved answer, self-mark it, and save the next-time rule.`;
    }
    if (assessment) {
        return `Map ${assessment.title} into three testable topics, then complete one checked practice answer.`;
    }
    const topic = recentTopics[0]?.topic;
    return topic
        ? `Do a 10 minute retrieval check on ${topic}, then ask Coach to mark the weakest sentence.`
        : "Complete one checked practice answer so the app can start calibrating this subject.";
};
export const refreshSubjectMemoryMap = async (userId, target) => {
    const resolved = await resolveSubjectTarget(userId, target);
    const today = toDateOnly(todayMelbourne());
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);
    const [signals, events, sessions] = await Promise.all([
        prisma.learningSignal.findMany({
            where: { userId, subjectKey: resolved.subjectKey },
            orderBy: { createdAt: "desc" },
            take: 80
        }),
        prisma.event.findMany({
            where: {
                userId,
                subjectId: resolved.subjectId ?? undefined,
                completed: false,
                eventType: { in: assessmentEventTypes },
                eventDate: { gte: today }
            },
            include: { subject: true },
            orderBy: { eventDate: "asc" },
            take: 8
        }),
        prisma.studySession.findMany({
            where: {
                userId,
                subjectId: resolved.subjectId ?? undefined,
                createdAt: { gte: fourteenDaysAgo }
            },
            select: { durationSeconds: true, createdAt: true, notes: true },
            orderBy: { createdAt: "desc" },
            take: 40
        })
    ]);
    const mapSignals = signals.map((signal) => ({
        signalType: signal.signalType,
        topic: signal.topic,
        title: signal.title,
        detail: signal.detail,
        evidence: signal.evidence,
        confidence: signal.confidence,
        nextAction: signal.nextAction,
        weight: signal.weight,
        sourceType: signal.sourceType,
        createdAt: signal.createdAt
    }));
    const strengths = aggregateSignals(mapSignals, new Set(["strength"]), 5);
    const weakAreas = aggregateSignals(mapSignals, weaknessTypes, 6);
    const commonMistakes = aggregateSignals(mapSignals.filter((signal) => /answer|mistake|note|question/i.test(signal.sourceType)), weaknessTypes, 6);
    const recentTopics = recentTopicSummary(mapSignals);
    const bestStudyMethods = studyMethodSummary(mapSignals);
    const upcomingAssessments = events.map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.eventType,
        eventDate: event.eventDate.toISOString().slice(0, 10),
        daysUntil: daysUntil(today, event.eventDate),
        topic: compact(event.description || event.title, 220),
        subject: event.subject?.subjectName ?? resolved.subjectName
    }));
    const recentStudyMinutes = Math.round(sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
    const recentWeaknessLoad = mapSignals
        .filter((signal) => weaknessTypes.has(signal.signalType) && signal.createdAt >= thirtyDaysAgo)
        .reduce((sum, signal) => sum + signal.weight, 0);
    const nearestAssessmentDays = upcomingAssessments[0]?.daysUntil ?? null;
    const repeatedQuestionLoad = mapSignals.filter((signal) => signal.signalType === "topic_interest" && signal.createdAt >= thirtyDaysAgo).length;
    let riskScore = 0;
    if (nearestAssessmentDays !== null) {
        if (nearestAssessmentDays <= 3)
            riskScore += 3;
        else if (nearestAssessmentDays <= 7)
            riskScore += 2;
        else if (nearestAssessmentDays <= 14)
            riskScore += 1;
    }
    if (recentWeaknessLoad >= 8)
        riskScore += 3;
    else if (recentWeaknessLoad >= 4)
        riskScore += 2;
    else if (recentWeaknessLoad >= 2)
        riskScore += 1;
    if (recentStudyMinutes < 60 && nearestAssessmentDays !== null && nearestAssessmentDays <= 14)
        riskScore += 1;
    if (repeatedQuestionLoad >= 4)
        riskScore += 1;
    const riskLevel = riskScore >= 5 ? "high" : riskScore >= 3 ? "medium" : "low";
    const predictedNextTask = predictedTaskFor(weakAreas, recentTopics, upcomingAssessments, riskLevel);
    const evidenceTrail = mapSignals.slice(0, 12).map((signal) => ({
        at: signal.createdAt.toISOString(),
        type: signal.signalType,
        topic: signal.topic,
        title: signal.title,
        evidence: signal.evidence,
        sourceType: signal.sourceType
    }));
    return prisma.studentSubjectMemory.upsert({
        where: { userId_subjectKey: { userId, subjectKey: resolved.subjectKey } },
        update: {
            subjectId: resolved.subjectId,
            subjectName: resolved.subjectName,
            strengths: strengths,
            weakAreas: weakAreas,
            commonMistakes: commonMistakes,
            recentTopics: recentTopics,
            upcomingAssessments: upcomingAssessments,
            bestStudyMethods: bestStudyMethods,
            evidenceTrail: evidenceTrail,
            riskLevel,
            predictedNextTask
        },
        create: {
            userId,
            subjectId: resolved.subjectId,
            subjectKey: resolved.subjectKey,
            subjectName: resolved.subjectName,
            strengths: strengths,
            weakAreas: weakAreas,
            commonMistakes: commonMistakes,
            recentTopics: recentTopics,
            upcomingAssessments: upcomingAssessments,
            bestStudyMethods: bestStudyMethods,
            evidenceTrail: evidenceTrail,
            riskLevel,
            predictedNextTask
        }
    });
};
export const repairLearningSignalSubjects = async (userId) => {
    const [subjects, signals] = await Promise.all([
        prisma.userSubject.findMany({ where: { userId, archivedAt: null }, select: { id: true, subjectName: true } }),
        prisma.learningSignal.findMany({
            where: { userId },
            select: {
                id: true,
                subjectId: true,
                subjectKey: true,
                subjectName: true,
                topic: true,
                title: true,
                detail: true,
                evidence: true,
                nextAction: true
            }
        })
    ]);
    const subjectsByName = new Map(subjects.map((subject) => [normaliseSubjectName(subject.subjectName), subject]));
    const updates = [];
    for (const signal of signals) {
        const inferredSubjectName = inferSubjectForSignal(signal);
        if (!inferredSubjectName)
            continue;
        const subject = subjectsByName.get(normaliseSubjectName(inferredSubjectName));
        if (!subject)
            continue;
        const nextSubjectKey = subjectKeyFor(subject.id, subject.subjectName);
        if (signal.subjectId === subject.id &&
            signal.subjectKey === nextSubjectKey &&
            sameSubjectName(signal.subjectName, subject.subjectName)) {
            continue;
        }
        updates.push(prisma.learningSignal.update({
            where: { id: signal.id },
            data: {
                subjectId: subject.id,
                subjectKey: nextSubjectKey,
                subjectName: subject.subjectName
            }
        }));
    }
    if (!updates.length)
        return 0;
    await prisma.$transaction(updates);
    return updates.length;
};
export const rebuildStudentMemoryMaps = async (userId) => {
    await repairLearningSignalSubjects(userId);
    const [subjects, signals] = await Promise.all([
        prisma.userSubject.findMany({ where: { userId, archivedAt: null }, select: { id: true, subjectName: true } }),
        prisma.learningSignal.findMany({
            where: {
                userId,
                OR: [{ subjectId: null }, { subject: { archivedAt: null } }]
            },
            distinct: ["subjectKey"],
            select: { subjectId: true, subjectKey: true, subjectName: true }
        })
    ]);
    const targets = new Map();
    for (const subject of subjects) {
        targets.set(subjectKeyFor(subject.id, subject.subjectName), {
            subjectId: subject.id,
            subjectName: subject.subjectName
        });
    }
    for (const signal of signals) {
        targets.set(signal.subjectKey, {
            subjectId: signal.subjectId,
            subjectKey: signal.subjectKey,
            subjectName: signal.subjectName
        });
    }
    return Promise.all([...targets.values()].map((target) => refreshSubjectMemoryMap(userId, target)));
};
const targetForSignal = (signal, eventTarget, fallbackSummary) => {
    const currentSubjectId = signal.subjectId === undefined ? eventTarget.subjectId : signal.subjectId;
    const currentSubjectName = signal.subjectName ?? eventTarget.subjectName;
    const inferredSubjectName = inferSubjectForSignal(signal, fallbackSummary);
    const preferredSubjectName = inferredSubjectName ?? currentSubjectName;
    const subjectChanged = preferredSubjectName ? !sameSubjectName(preferredSubjectName, eventTarget.subjectName) : false;
    return {
        subjectId: subjectChanged ? null : currentSubjectId,
        subjectName: preferredSubjectName ?? eventTarget.subjectName
    };
};
export const recordStudentMemory = async (input, options = {}) => {
    try {
        const eventTarget = await resolveSubjectTarget(input.userId, {
            subjectId: input.subjectId,
            subjectName: input.subjectName
        });
        const memoryEvent = await prisma.studentMemoryEvent.create({
            data: {
                userId: input.userId,
                subjectId: eventTarget.subjectId,
                eventType: input.eventType,
                sourceType: input.sourceType,
                sourceId: input.sourceId ?? null,
                title: compact(input.title, 180) || input.eventType,
                summary: compact(input.summary, 4000) || input.title,
                payload: input.payload ?? {},
                importance: clamp(input.importance ?? 1, 1, 5)
            }
        });
        const extracted = options.extractAiSignals
            ? await extractLearningSignalsFromMemoryEvent({
                eventType: input.eventType,
                subject: eventTarget.subjectName,
                topic: options.topic,
                summary: input.summary,
                evidence: options.evidence ?? input.summary,
                payload: input.payload
            })
            : [];
        const extractedSignals = extracted.map((signal) => ({
            signalType: normalizeSignalType(signal.signal_type),
            subjectId: eventTarget.subjectId,
            subjectName: signal.subject ?? eventTarget.subjectName,
            topic: signal.topic ?? options.topic ?? null,
            title: signal.title,
            detail: signal.detail,
            evidence: signal.evidence,
            confidence: signal.confidence,
            nextAction: signal.next_action ?? null,
            weight: signal.weight,
            sourceType: input.sourceType,
            sourceId: input.sourceId ?? null
        }));
        const normalizedSignals = uniqueBy([...(options.signals ?? []), ...extractedSignals]
            .filter((signal) => compact(signal.title) && compact(signal.detail) && compact(signal.evidence))
            .slice(0, 8), (signal) => `${signal.signalType}:${(signal.topic ?? "").toLowerCase()}:${signal.title.toLowerCase()}`);
        const createInputs = [];
        for (const signal of normalizedSignals) {
            const target = await resolveSubjectTarget(input.userId, targetForSignal(signal, eventTarget, input.summary));
            createInputs.push({
                userId: input.userId,
                subjectId: target.subjectId,
                subjectKey: target.subjectKey,
                subjectName: target.subjectName,
                memoryEventId: memoryEvent.id,
                signalType: normalizeSignalType(signal.signalType),
                topic: compact(signal.topic, 140) || null,
                title: compact(signal.title, 180),
                detail: compact(signal.detail, 900),
                evidence: compact(signal.evidence, 700),
                confidence: signal.confidence ?? "medium",
                nextAction: compact(signal.nextAction, 500) || null,
                weight: clamp(signal.weight ?? input.importance ?? 1, 1, 5),
                sourceType: signal.sourceType ?? input.sourceType,
                sourceId: signal.sourceId === undefined ? input.sourceId ?? null : signal.sourceId
            });
        }
        if (createInputs.length) {
            await prisma.learningSignal.createMany({ data: createInputs });
        }
        const refreshTargets = new Map();
        refreshTargets.set(eventTarget.subjectKey, eventTarget);
        for (const signal of createInputs) {
            refreshTargets.set(signal.subjectKey, {
                subjectId: signal.subjectId,
                subjectKey: signal.subjectKey,
                subjectName: signal.subjectName
            });
        }
        await Promise.all([...refreshTargets.values()].map((target) => refreshSubjectMemoryMap(input.userId, target)));
        return memoryEvent;
    }
    catch (error) {
        console.warn("Student memory write failed", error);
        return null;
    }
};
