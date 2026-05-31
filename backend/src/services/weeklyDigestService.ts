import crypto from "node:crypto";
import { prisma } from "../db/prismaClient.js";
import { APP_TIME_ZONE, addDays, dateKeyInMelbourne, toDateOnly } from "../utils/date.js";
import { isAdminEmail } from "./adminService.js";
import { defaultFromEmail, escapeHtml, smtpTransport } from "./contactEmailService.js";

type SendWeeklyDigestOptions = {
  force?: boolean;
  targetEmail?: string;
  includeAdmins?: boolean;
};

type SendWeeklyDigestSummary = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  reason?: "disabled" | "smtp_missing";
};

const DEFAULT_WEEKLY_DIGEST_CRON = "0 0 18 * * 0";
const dayNameMap: Record<string, string> = {
  sun: "0",
  sunday: "0",
  mon: "1",
  monday: "1",
  tue: "2",
  tuesday: "2",
  wed: "3",
  wednesday: "3",
  thu: "4",
  thursday: "4",
  fri: "5",
  friday: "5",
  sat: "6",
  saturday: "6"
};

const normalizeDayField = (value: string) =>
  value.replace(/[a-z]+/gi, (match) => dayNameMap[match.toLowerCase()] ?? match);

const cleanCronExpression = (value?: string) => {
  const trimmed = value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  if (!trimmed) return DEFAULT_WEEKLY_DIGEST_CRON;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    parts[4] = normalizeDayField(parts[4]);
    return `0 ${parts.join(" ")}`;
  }
  if (parts.length === 6) {
    parts[5] = normalizeDayField(parts[5]);
    return parts.join(" ");
  }

  console.warn(`Invalid WEEKLY_DIGEST_CRON "${trimmed}". Falling back to ${DEFAULT_WEEKLY_DIGEST_CRON}.`);
  return DEFAULT_WEEKLY_DIGEST_CRON;
};

export const weeklyDigestCronExpression = () => cleanCronExpression(process.env.WEEKLY_DIGEST_CRON);

export const isWeeklyDigestEnabled = () => process.env.WEEKLY_DIGEST_ENABLED?.toLowerCase() !== "false";

const appBaseUrl = () =>
  (process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://www.vceforge.space").trim().replace(/\/$/, "");

const digestSecret = () => process.env.WEEKLY_DIGEST_SECRET || process.env.JWT_SECRET || "dev_secret";

const hmac = (value: string) => crypto.createHmac("sha256", digestSecret()).update(value).digest("base64url");

export const createWeeklyDigestUnsubscribeToken = (user: { id: string; email: string }) => {
  const normalisedEmail = user.email.trim().toLowerCase();
  const signature = hmac(`${user.id}:${normalisedEmail}`);
  return Buffer.from(JSON.stringify({ userId: user.id, signature })).toString("base64url");
};

export const verifyWeeklyDigestUnsubscribeToken = async (token: string) => {
  let parsed: { userId?: string; signature?: string };
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as { userId?: string; signature?: string };
  } catch {
    return null;
  }

  if (!parsed.userId || !parsed.signature) return null;

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, email: true, weeklyDigestOptIn: true }
  });
  if (!user) return null;

  const expected = hmac(`${user.id}:${user.email.trim().toLowerCase()}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parsed.signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return user;
};

export const unsubscribeWeeklyDigest = async (token: string) => {
  const user = await verifyWeeklyDigestUnsubscribeToken(token);
  if (!user) return null;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      weeklyDigestOptIn: false,
      weeklyDigestUnsubscribedAt: new Date()
    },
    select: { id: true, email: true, displayName: true }
  });
};

const currentWeekRange = (now = new Date()) => {
  const todayKey = dateKeyInMelbourne(now);
  const today = toDateOnly(todayKey);
  const day = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const weekStartKey = today.toISOString().slice(0, 10);
  const weekEndKey = addDays(weekStartKey, 7);
  return {
    todayKey,
    weekStartKey,
    weekEndKey,
    weekStart: toDateOnly(weekStartKey),
    weekEnd: toDateOnly(weekEndKey),
    nextWeekEnd: toDateOnly(addDays(todayKey, 8))
  };
};

const loadDigestUsers = async (options: SendWeeklyDigestOptions, range: ReturnType<typeof currentWeekRange>) =>
  prisma.user.findMany({
    where: {
      weeklyDigestOptIn: true,
      weeklyDigestUnsubscribedAt: null,
      ...(options.targetEmail ? { email: options.targetEmail.trim().toLowerCase() } : {})
    },
    orderBy: { createdAt: "asc" },
    take: options.targetEmail ? 1 : 500,
    select: {
      id: true,
      email: true,
      displayName: true,
      weeklyDigestLastSentAt: true,
      gamification: {
        select: {
          level: true,
          currentStreak: true,
          totalXp: true,
          xpBalance: true
        }
      },
      subjects: {
        where: { archivedAt: null },
        select: { id: true, subjectName: true, color: true }
      },
      sessions: {
        where: { createdAt: { gte: range.weekStart, lt: range.weekEnd } },
        orderBy: { createdAt: "desc" },
        select: {
          durationSeconds: true,
          xpEarned: true,
          createdAt: true,
          subject: { select: { subjectName: true } }
        }
      },
      savedQuestions: {
        where: { createdAt: { gte: range.weekStart, lt: range.weekEnd } },
        select: { id: true, topic: true }
      },
      notes: {
        where: { createdAt: { gte: range.weekStart, lt: range.weekEnd } },
        select: { id: true }
      },
      resources: {
        where: { createdAt: { gte: range.weekStart, lt: range.weekEnd } },
        select: { id: true }
      },
      learningSignals: {
        where: { createdAt: { gte: range.weekStart, lt: range.weekEnd } },
        orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: {
          title: true,
          detail: true,
          subjectName: true,
          nextAction: true
        }
      },
      events: {
        where: {
          completed: false,
          eventDate: { gte: toDateOnly(range.todayKey), lt: range.nextWeekEnd }
        },
        orderBy: { eventDate: "asc" },
        take: 5,
        select: {
          title: true,
          eventType: true,
          eventDate: true,
          subject: { select: { subjectName: true } }
        }
      }
    }
  });

type DigestUser = Awaited<ReturnType<typeof loadDigestUsers>>[number];

const minutes = (seconds: number) => Math.round(seconds / 60);

const formatShortDate = (date: Date) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);

const formatWeekLabel = (range: ReturnType<typeof currentWeekRange>) =>
  `${formatShortDate(range.weekStart)} - ${formatShortDate(new Date(range.weekEnd.getTime() - 1))}`;

const subjectBreakdown = (user: DigestUser) => {
  const subjects = new Map<string, { name: string; seconds: number }>();
  for (const session of user.sessions) {
    const name = session.subject?.subjectName || "General study";
    const current = subjects.get(name) ?? { name, seconds: 0 };
    current.seconds += session.durationSeconds;
    subjects.set(name, current);
  }
  return [...subjects.values()].sort((a, b) => b.seconds - a.seconds);
};

const strongestLine = (user: DigestUser) => {
  const topSubject = subjectBreakdown(user)[0];
  if (topSubject) return `${topSubject.name}: ${minutes(topSubject.seconds)} minutes logged`;
  if (user.subjects[0]) return `${user.subjects[0].subjectName}: ready for the first block`;
  return "Add subjects so Forge can build a sharper weekly plan.";
};

const nextMove = (user: DigestUser) => {
  const firstSignal = user.learningSignals[0];
  if (firstSignal?.nextAction) return firstSignal.nextAction;
  if (firstSignal) return `Repair ${firstSignal.subjectName}: ${firstSignal.title}.`;
  const nextEvent = user.events[0];
  if (nextEvent) return `Start with ${nextEvent.subject?.subjectName || nextEvent.eventType}: ${nextEvent.title}.`;
  const topSubject = subjectBreakdown(user)[0];
  if (topSubject) return `Repeat the strongest habit: one focused block for ${topSubject.name}.`;
  return "Log one 25-minute block so next week has evidence to work from.";
};

const buildDigest = (user: DigestUser, range: ReturnType<typeof currentWeekRange>) => {
  const totalSeconds = user.sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const totalXp = user.sessions.reduce((sum, session) => sum + session.xpEarned, 0);
  const sessionCount = user.sessions.length;
  const totalMinutes = minutes(totalSeconds);
  const appUrl = appBaseUrl();
  const unsubscribeUrl = `${appUrl}/api/digest/unsubscribe/${createWeeklyDigestUnsubscribeToken(user)}`;
  const eventLines = user.events.length
    ? user.events.map((event) => `${formatShortDate(event.eventDate)} - ${event.title}`).join("\n")
    : "No SACs or exams logged for the next few days.";
  const signalLines = user.learningSignals.length
    ? user.learningSignals.map((signal) => `${signal.subjectName}: ${signal.title}`).join("\n")
    : "No weak spots flagged yet. Use Study or Questions to create evidence.";

  const text = [
    `Hey ${user.displayName},`,
    "",
    `Your VCE Forge week: ${formatWeekLabel(range)}.`,
    "",
    `${totalMinutes} min studied`,
    `${sessionCount} session${sessionCount === 1 ? "" : "s"}`,
    `${totalXp} XP earned`,
    `${user.savedQuestions.length} practice question${user.savedQuestions.length === 1 ? "" : "s"} saved`,
    `${user.notes.length + user.resources.length} note/resource item${user.notes.length + user.resources.length === 1 ? "" : "s"} added`,
    "",
    `Best signal: ${strongestLine(user)}`,
    `Next move: ${nextMove(user)}`,
    "",
    "Upcoming pressure:",
    eventLines,
    "",
    "Weak spots / memory:",
    signalLines,
    "",
    `Open Forge: ${appUrl}`,
    "",
    `Unsubscribe from weekly emails: ${unsubscribeUrl}`
  ].join("\n");

  const html = `
    <div style="margin:0;background:#07111d;color:#f4f7ff;font-family:Arial,sans-serif;line-height:1.5;padding:28px;">
      <div style="max-width:640px;margin:0 auto;background:#0f1d2d;border:1px solid #1f4260;border-radius:8px;padding:28px;">
        <p style="margin:0 0 8px;color:#38bdf8;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">VCE Forge weekly brief</p>
        <h1 style="margin:0 0 10px;font-size:30px;line-height:1.05;">${escapeHtml(totalMinutes ? `${totalMinutes} minutes banked.` : "Start clean next week.")}</h1>
        <p style="margin:0 0 22px;color:#a8b3ca;">${escapeHtml(formatWeekLabel(range))}</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:22px;">
          ${[
            ["Study", `${totalMinutes}m`],
            ["Sessions", String(sessionCount)],
            ["XP", String(totalXp)],
            ["Questions", String(user.savedQuestions.length)]
          ]
            .map(
              ([label, value]) => `
                <div style="background:#15263a;border:1px solid #244762;border-radius:6px;padding:14px;">
                  <div style="color:#8fa2bd;font-size:13px;">${label}</div>
                  <div style="font-size:24px;font-weight:800;">${value}</div>
                </div>
              `
            )
            .join("")}
        </div>
        <div style="background:#111a2a;border-left:4px solid #38bdf8;border-radius:6px;padding:16px;margin-bottom:16px;">
          <p style="margin:0;color:#8fa2bd;font-size:13px;text-transform:uppercase;font-weight:700;">Best signal</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;">${escapeHtml(strongestLine(user))}</p>
        </div>
        <div style="background:#111a2a;border-left:4px solid #f59e0b;border-radius:6px;padding:16px;margin-bottom:22px;">
          <p style="margin:0;color:#8fa2bd;font-size:13px;text-transform:uppercase;font-weight:700;">Next move</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;">${escapeHtml(nextMove(user))}</p>
        </div>
        <h2 style="margin:0 0 8px;font-size:18px;">Upcoming pressure</h2>
        <ul style="margin:0 0 18px;padding-left:20px;color:#dbe7ff;">
          ${
            user.events.length
              ? user.events
                  .map((event) => `<li>${escapeHtml(formatShortDate(event.eventDate))}: ${escapeHtml(event.title)}</li>`)
                  .join("")
              : "<li>No SACs or exams logged for the next few days.</li>"
          }
        </ul>
        <h2 style="margin:0 0 8px;font-size:18px;">Weak spots / memory</h2>
        <ul style="margin:0 0 24px;padding-left:20px;color:#dbe7ff;">
          ${
            user.learningSignals.length
              ? user.learningSignals
                  .map((signal) => `<li>${escapeHtml(signal.subjectName)}: ${escapeHtml(signal.title)}</li>`)
                  .join("")
              : "<li>No weak spots flagged yet. Use Study or Questions to create evidence.</li>"
          }
        </ul>
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#38bdf8;color:#07111d;text-decoration:none;font-weight:800;border-radius:6px;padding:12px 18px;">Open VCE Forge</a>
        <p style="margin:24px 0 0;color:#8fa2bd;font-size:12px;">
          You are receiving this because you created a VCE Forge account.
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8bdcff;">Unsubscribe from weekly emails</a>.
        </p>
      </div>
    </div>
  `;

  return { subject: `Your VCE Forge week: ${totalMinutes}m studied`, text, html };
};

export const sendWeeklyDigestToAllUsers = async (
  options: SendWeeklyDigestOptions = {}
): Promise<SendWeeklyDigestSummary> => {
  if (!isWeeklyDigestEnabled() && !options.force) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, reason: "disabled" };
  }

  const transport = await smtpTransport();
  if (!transport) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0, reason: "smtp_missing" };
  }

  const range = currentWeekRange();
  const users = await loadDigestUsers(options, range);
  const from = defaultFromEmail("VCE Forge <no-reply@vceforge.space>");
  const summary: SendWeeklyDigestSummary = { attempted: 0, sent: 0, skipped: 0, failed: 0 };

  for (const user of users) {
    const alreadySentThisWeek = user.weeklyDigestLastSentAt && user.weeklyDigestLastSentAt >= range.weekStart;
    if ((!options.includeAdmins && isAdminEmail(user.email)) || (!options.force && alreadySentThisWeek)) {
      summary.skipped += 1;
      continue;
    }

    const digest = buildDigest(user, range);
    summary.attempted += 1;

    try {
      await transport.sendMail({
        to: user.email,
        from,
        subject: digest.subject,
        text: digest.text,
        html: digest.html
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { weeklyDigestLastSentAt: new Date() }
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`Weekly digest failed for ${user.email}`, error);
    }
  }

  return summary;
};
