import "dotenv/config";
import cors, { type CorsOptions } from "cors";
import cron from "node-cron";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { subjectsRouter } from "./routes/subjects.js";
import { sessionsRouter } from "./routes/sessions.js";
import { eventsRouter } from "./routes/events.js";
import { goalsRouter } from "./routes/goals.js";
import { questionsRouter } from "./routes/questions.js";
import { gamificationRouter } from "./routes/gamification.js";
import { coachRouter } from "./routes/coach.js";
import { communityRouter } from "./routes/community.js";
import { contactRouter } from "./routes/contact.js";
import { digestRouter } from "./routes/digest.js";
import { memoryRouter } from "./routes/memory.js";
import { ensureDatabaseSchema } from "./db/ensureSchema.js";
import { errorHandler } from "./utils/http.js";
import { resetExpiredStreaks } from "./services/gamificationService.js";
import { sendWeeklyDigestToAllUsers, weeklyDigestCronExpression } from "./services/weeklyDigestService.js";
import { APP_TIME_ZONE } from "./utils/date.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

const allowedOrigins = [
  "https://vce-study-tracker-sasen.netlify.app",
  "https://vceforge.space",
  "https://www.vceforge.space",
  "http://localhost:3000",
  "http://localhost:8081",
  "http://localhost:19006"
];

const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"]
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "vce-study-tracker-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/subjects", subjectsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/gamification", gamificationRouter);
app.use("/api/coach", coachRouter);
app.use("/api/community", communityRouter);
app.use("/api/contact", contactRouter);
app.use("/api/digest", digestRouter);
app.use("/api/memory", memoryRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "API route not found. The backend may need to be updated or restarted." });
});

app.use(errorHandler);

cron.schedule(
  "59 23 * * *",
  async () => {
    try {
      const result = await resetExpiredStreaks();
      console.log(`Streak reset job completed. Updated ${result.count} users.`);
    } catch (error) {
      console.error("Streak reset job failed", error);
    }
  },
  {
    timezone: APP_TIME_ZONE
  }
);

try {
  cron.schedule(
    weeklyDigestCronExpression(),
    async () => {
      try {
        const result = await sendWeeklyDigestToAllUsers();
        console.log(`Weekly digest job completed. Sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}.`);
      } catch (error) {
        console.error("Weekly digest job failed", error);
      }
    },
    {
      timezone: APP_TIME_ZONE
    }
  );
} catch (error) {
  console.error("Weekly digest cron could not be scheduled. The API will still start.", error);
}

const start = async () => {
  await ensureDatabaseSchema();
  app.listen(port, () => {
    console.log(`VCE Forge API running on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start VCE Forge API", error);
  process.exit(1);
});
