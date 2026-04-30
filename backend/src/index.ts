import "dotenv/config";
import cors from "cors";
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
import { billingRouter, stripeWebhookHandler } from "./routes/billing.js";
import { errorHandler } from "./utils/http.js";
import { resetExpiredStreaks } from "./services/gamificationService.js";
import { APP_TIME_ZONE } from "./utils/date.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
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
app.use("/api/billing", billingRouter);

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

app.listen(port, () => {
  console.log(`VCE Study Tracker API running on http://localhost:${port}`);
});
