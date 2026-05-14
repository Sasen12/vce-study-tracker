# VCE Study Tracker - Full App Context For A Local Coding Model

Use this document as the high-level repository context when asking a local AI coding model to modify this app. It maps the app as it exists in this workspace.

## Product Identity

- App name in `app.json`: `VCE Study Tracker`.
- Login brand text: `VCE Pulse`.
- Package name: `vce-study-tracker`.
- Product: a full-stack study tracker for Australian VCE students, focused on Year 11/12 workflow, SAC/SAT/exam preparation, AI-generated practice, adaptive roadmaps, class notes, student memory, gamification, and community.
- Primary UX: dark-mode mobile-first Expo app, also run on web through Expo.
- User location/domain assumptions in the app: Australian VCE, Melbourne/Victoria school context, `en-AU` formatting, app streak timezone `Australia/Melbourne`.

## Stack

Frontend:

- Expo SDK 51, React Native 0.74, Expo Router 3.
- React Native Paper for UI controls.
- Zustand for state.
- Expo SecureStore on native and `localStorage` on web for auth tokens.
- React Native Calendars, Reanimated, Gesture Handler, Gifted Charts, SVG, Expo AV, Document Picker, Haptics.
- Fonts: Outfit regular and bold from `@expo-google-fonts/outfit`.

Backend:

- Node.js, Express, TypeScript ESM.
- Prisma with PostgreSQL.
- JWT auth with access and refresh tokens.
- bcryptjs for passwords.
- OpenAI SDK v6 using Responses API and zod structured outputs.
- Multer for uploads, pdf-parse, mammoth and word-extractor for resource extraction.
- node-cron for streak reset.

## Commands And Runtime

Root scripts:

- `npm run launch`: Windows helper that starts Docker Postgres, Prisma/backend prep, backend, and Expo web.
- `npm run start`: Expo dev server.
- `npm run web`: Expo web.
- `npm run backend`: `npm run dev --prefix backend`.
- `npm run build:web`: `expo export -p web && node scripts/write-build-info.mjs`.
- `npm run lint`: Expo lint.
- `npm run backend:prisma`: Prisma generate in backend.

Backend scripts:

- `npm run dev`: `tsx watch src/index.ts`.
- `npm run build`: TypeScript build.
- `npm run start`: `node dist/index.js`.
- `npm run prisma:generate`, `prisma:push`, `prisma:migrate`, `seed`.

Important env:

- Frontend reads `EXPO_PUBLIC_API_URL`, defaulting to `/api`.
- Local default in README: `EXPO_PUBLIC_API_URL=http://localhost:3000/api`.
- Backend reads `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, optional AI limit/admin env.
- `OPENAI_MODEL` defaults in README to `gpt-5.4-mini`.
- `OPENAI_TRANSCRIBE_MODEL` defaults in code to `gpt-4o-mini-transcribe`.
- If `OPENAI_API_KEY` is missing or placeholder-like, backend returns deterministic mock AI outputs so the app still works.

## Repository Map

Key folders:

- `app/`: Expo Router routes.
- `app/(auth)/`: login/register auth screens.
- `app/(tabs)/`: authenticated tab screens.
- `components/ui/`: shared screen/card/skeleton/selector/ambient UI.
- `components/session/`: Study tab panels: Coach, Ask Coach, Notes, Files, Music, Class Notetaker, Chess.
- `components/questions/`: question visual renderer.
- `components/tools/`: scientific calculator.
- `components/gamification/`: XP/streak/badges.
- `constants/`: theme, subjects, gamification, music, ATAR estimate, feature flags.
- `hooks/`: theme, screen tracking, browser reminders.
- `services/`: frontend API client.
- `store/`: Zustand stores.
- `types/`: shared frontend TypeScript types.
- `utils/`: VCE coach helpers, subject tools/routing, spaced review, calendar utilities, calculator, streaks.
- `backend/src/routes/`: Express route modules.
- `backend/src/services/`: AI, gamification, resource extraction, student memory, admin.
- `backend/src/resources/`: VCE study design context and subject catalogues.
- `backend/src/db/`: Prisma client/schema/seed/ensure schema.

## Frontend App Shell

Root layout: `app/_layout.tsx`

- Prevents splash auto-hide, hydrates auth, loads Outfit fonts, then renders a hidden-header Stack.
- Wraps app in `GestureHandlerRootView`, `PaperProvider`, `StatusBar`, and `BuildUpdateNotice`.
- React Native Paper dark theme is dynamically recolored from `useActivePalette`.

Index route: `app/index.tsx`

- Redirects to `/(tabs)` if `authStore.user` exists.
- Redirects to `/(auth)/login` otherwise.

Auth layout: `app/(auth)/_layout.tsx`

- Redirects authenticated users to tabs.
- Otherwise renders auth Stack.

Tabs layout: `app/(tabs)/_layout.tsx`

- Requires authenticated user, otherwise redirects to login.
- Calls `useStudyReminders()`.
- Tab bar is absolute, dark, 74px high.
- Visible tabs: Home, Study, Calendar, Questions, Community, Shop, Profile.
- Hidden tab routes: `insights` (Student Map) and `pro`.

## Shared Frontend Patterns

Use these existing primitives unless there is a strong reason not to:

- `Screen`: safe-area dark background, active theme ambient motion, scroll container, focus animation, scroll cue.
- `AppCard`: active theme card surface, 8px radius-ish style, used for contained content.
- `SubjectSelector`: horizontal subject chips.
- `EmptyState`, `Skeleton`, `SkeletonStack`, `ProgressRing`.
- `palette` from `constants/theme.ts` is still used by many files directly, even though active theme colors also exist.

Styling conventions:

- Dark UI, Outfit font.
- Cards and controls generally use 8px radius or less.
- Layouts are mostly flex rows with wrap and small gaps.
- Avoid nested card-heavy layout changes unless matching existing files.

## State And API Flow

`services/api.ts`

- `API_URL = process.env.EXPO_PUBLIC_API_URL ?? "/api"`.
- Auth token storage:
  - web: `localStorage`
  - native: Expo SecureStore
- Tokens:
  - access key `vce_access_token`
  - refresh key `vce_refresh_token`
- `apiFetch` sends JSON, auth bearer token, and `ngrok-skip-browser-warning`.
- On 401 it calls `/auth/refresh`, stores new tokens, and retries once.
- `apiUpload` sends `FormData` without forcing `Content-Type`, with auth header.

`store/authStore.ts`

- State: `user`, `authReady`, `loading`, `error`.
- Actions: `hydrate`, `login`, `register`, `logout`.
- Login/register call `/auth/login` and `/auth/register`, store tokens, set user.
- Hydrate checks `/auth/me`; failed token clears auth.

`store/appStore.ts`

- Central frontend data store.
- State includes:
  - `subjects`, `sessions`, `events`, `goals`
  - `savedQuestions`, `generatedQuestions`
  - `reflections`, `notes`, `resources`
  - `subjectMemories`, `latestPlan`
  - `gamification`, `leaderboard`, `stats`
  - `loading`, `error`
- `fetchAll()` loads almost everything in parallel:
  - subjects, sessions, stats, events, goals, saved questions, gamification, leaderboard, reflections, notes, resources, student memory map, latest plan.
- Mutating actions call `studyApi` and update local state or refresh relevant data.

`services/studyApi.ts`

- Thin typed wrapper over REST endpoints.
- Keep new frontend calls in this file rather than calling `apiFetch` directly from screens unless matching existing style.

## Auth Screens

`app/(auth)/login.tsx`

- Brand: gradient mark, title `VCE Pulse`, subtitle about study sessions, SAC dates, AI drills and small wins.
- Form: email, password, inline error, `Log in`, link to register.
- On success, `router.replace("/(tabs)")`.

`app/(auth)/register.tsx`

- Title `Build your VCE stack`.
- Collects display name, email, school name, password.
- Infers school name from recognised `vic.edu.au` email using `utils/schoolEmail.ts`.
- Students choose up to 8 subjects from `VCE_SUBJECTS`, grouped by VCE category.
- Each selected subject has unit selector (`1/2` or `3/4` if available), color, optional target study score.
- Submit calls auth store `register`, then routes to tabs.

## Tabs And Screens

### Home Dashboard

File: `app/(tabs)/index.tsx`

Purpose: landing dashboard after login.

Data:

- Uses auth user and app store data.
- On focus: `fetchAll()`, `/coach/daily-inspiration`, `/community/gifts`.

Major UI:

- Greeting with date and active streak.
- Global search over notes, saved questions, events, and uploaded resources.
- Student Map shortcut level chip.
- Daily spark card from AI, fallback if unavailable.
- `SAC Panic Mode`: creates a local plan note using `buildSacPanicPlan`.
- `VCE Weakness Coach`: uses `buildWeaknessSummary`, routes to Study or Questions.
- `Protect the next deadline`: routes to Study or Calendar.
- Upcoming event list.
- Gift messages from admin gifts.
- Special thank-you card if a hardcoded user has Cherry Blossom unlocked.
- Leaderboard opt-in prompt if not yet prompted.

Local helper logic:

- `subjectForDeadline` tries matching subject by event title before using event relation.
- Study-time events are excluded from upcoming deadline pressure.

### Student Map

File: `app/(tabs)/insights.tsx`

This route is hidden from tab bar but reachable from Home.

Purpose: learning profile/memory map.

Data:

- Uses app store stats, sessions, notes, saved questions, events, goals, gamification, `subjectMemories`.
- Calls `refreshStudentMemoryMap()` to rebuild from memory events/signals.

Major UI:

- Hero for selected subject memory with mastery %, risk, predicted next task.
- Metrics: mapped subjects, high risk, weak areas, evidence points.
- Horizontal subject mastery tiles sorted by risk and mastery.
- Sections for selected subject:
  - Weak area tracker
  - Common mistakes
  - Strengths
  - Risk links to upcoming assessments
  - Recent topics and best study methods
  - Evidence trail
- Level card and weekly report.
- Study pulse metrics and subject mix chart.
- Weekly pace list.
- Continue list for latest SAC plan, mistake, or flashcard.

Mastery is derived locally:

- Base 58 plus strengths/recent topics, minus weak areas/mistakes/risk penalty, clamped 14-96.

### Study

File: `app/(tabs)/study.tsx`

Purpose: main work surface.

Modes:

- `coach`
- `notes`
- `resources`
- `calculator` if any calculator-compatible subject exists
- `chess`
- `timer`

Query params:

- `subjectId`
- `mode`
- `tutorTopic`
- `tutorGoal`
- `tutorEventId`
- `tutorEventTitle`

Timer mode:

- Select subject.
- Optional session topic.
- Target length segmented buttons: 25m, 50m, 75m.
- Estimates XP: 10 XP per 10 minutes, plus 25 XP for sessions over an hour, plus timer check-in bonus XP.
- Check-in questions:
  - Enabled only if a topic is present.
  - Every 10 minutes, calls `timerCheckQuestion`.
  - Correct answer gives +8 bonus XP.
  - Wrong answer creates a mistake-log note.
- Focus filter:
  - On web, attempts fullscreen lock.
  - Pauses if fullscreen exits or tab loses focus while locked.
  - Hides extra tools while running in focus mode.
- Stop opens summary dialog after at least one minute.
- Saving a session calls `saveSession`; typed notes are also mirrored into a study note tagged `session-summary`.
- Confetti fires on level-up.

Other modes:

- `coach`: renders `StudyCoachPanel`.
- `notes`: renders `StudyNotesPanel`.
- `resources`: renders `StudyResourcesPanel`.
- `calculator`: renders `ScientificCalculator`.
- `chess`: renders `ChessBreak`.
- `StudyMusicPanel` is shown inside timer mode.

### Study Coach Panel

File: `components/session/StudyCoachPanel.tsx`

Purpose: subject-aware coach, class logs, adaptive roadmap.

Subcomponents and behavior:

- Subject selector.
- `StudyAskCard` for direct/tutor AI question flow.
- Class log form:
  - class date
  - what happened
  - what made sense
  - what did not click
  - next move
  - saves `StudyReflection`.
- Saved class logs list with expandable details.
- Study roadmap:
  - controls: daily minutes, horizon days, extra focus.
  - auto-generates if calendar event signature changes and plan is stale.
  - calls `generatePlan`.
  - filters daily plan and source events by selected subject.
  - roadmap views: Timeline, Subjects, Sources.
  - Creates subject-specific task wording locally for Business, English, General Maths, Software Development, Data Analytics, and fallback subjects.
  - Uses upcoming assessments and scheduled study blocks from Calendar.

### Ask Coach Card

File: `components/session/StudyAskCard.tsx`

Purpose: direct AI help and tutor-session mode.

Key concepts:

- `CoachMode = "coach" | "tutor"`.
- Tags used in saved notes:
  - `coach-answer`
  - `coach-chat`
  - `tutor-session`
  - `tutor-turn`
- Max tutor attachments: 6.
- Supports text question, tutor topic/goal/session, pasted/selected images, attached PDFs.
- Uses `askStudyQuestion(formData)`.
- Saves answers and chat/tutor turns as notes.
- Has follow-up question chips/buttons, copy behavior on web, and previous saved coach chats.

### Notes Panel

File: `components/session/StudyNotesPanel.tsx`

Purpose: study notes with structured templates and embedded images.

Behavior:

- Subject selector is controlled by parent Study screen.
- Supports note types:
  - `general`
  - `worked_example`
  - `formula`
  - `mistake_log`
- General Mathematics gets templates for worked examples, formulas, mistake logs.
- Supports up to 6 embedded images in markdown data URLs.
- On web, paste handler captures images; image compression is done client-side.
- Notes can be saved, edited, viewed, deleted.

### Resources Panel

File: `components/session/StudyResourcesPanel.tsx`

Purpose: upload and inspect local study context.

Source types:

- `textbook`
- `notes`
- `exam`
- `exam_report`
- `practice_sac`
- `practice_sat`
- `obsidian`

Accepted file types:

- PDF for textbook/exam-ish sources.
- Word docs.
- Markdown/text for notes/Obsidian.

Behavior:

- Uploads files as `FormData` to `/coach/resources/upload`.
- Lists resources with subject/source/type preview.
- Can open full extracted text and download text.
- Can delete resources.

### Class Notetaker Panel

File: `components/session/ClassNotetakerPanel.tsx`

Purpose: browser/native class recording and live class notes.

Behavior:

- Uses browser SpeechRecognition when available for live transcript chunks.
- Uses MediaRecorder audio recording.
- Requires consent acknowledgement.
- Sends 45-second-ish chunks to `/coach/notetaker/chunk` when enough words exist.
- Final audio upload goes to `/coach/notetaker`.
- Generates a saved note tagged `class-notetaker` and `ai-generated`.

### Music, Calculator, Chess

`StudyMusicPanel` and `store/studyMusicStore.ts`:

- Uses Expo AV.
- Plays curated remote study music tracks from `constants/studyMusic.ts`.
- Repeat toggle, next-track auto advance, license/source links.

`ScientificCalculator`:

- UI wrapper over `utils/scientificCalculator.ts`.
- Angle mode segmented control.
- Supports scientific functions and a keypad.

`ChessBreak`:

- Uses `chess.js`.
- User plays white against a black bot.
- Difficulty: easy, medium, hard.
- Bot logic uses random/immediate/reply-aware scoring.

### Calendar

File: `app/(tabs)/calendar.tsx`

Purpose: assessment radar and scheduled study/tutor blocks.

Event kinds in UI:

- `assessment`
- `study`
- `tutor`

Event types in data:

- `SAC`
- `SAT`
- `PRACTICE_SAC`
- `PRACTICE_SAT`
- `EXAM`
- `TASK`
- `STUDY_TIME`

Behavior:

- Shows assessment pressure metrics: today, next 7 days, upcoming.
- Uses `react-native-calendars` multi-dot marking.
- Expands recurring events with `utils/studyEvents.ts`.
- Recurrence:
  - `NONE`
  - `WEEKLY`
  - `FORTNIGHTLY_WEEK_1`
  - `FORTNIGHTLY_WEEK_2`
- Add/edit dialog supports:
  - title
  - subject/flexible
  - date
  - times for study/tutor
  - recurrence and repeat-until for study/tutor
  - reminder minutes
  - description/topic
- Tutor sessions are `STUDY_TIME` events with `source: "tutor_session"`.
- Start tutor routes to Study Coach with tutor params.
- Swipe right action completes non-study events.
- Browser reminders use Notification API and local/session storage.

### Questions

File: `app/(tabs)/questions.tsx`

This is the active IDE file and the most complex single screen.

Top-level screen title:

- Eyebrow: `AI practice`
- Title: `Question forge`

Top-level modes:

- `generate`: label `Forge`
- `game`: label `Battle`
- `saved`: label `Saved`
- `tools`: label `Tools`

Shared question controls:

- Subject selector.
- Topic input.
- Preset topic chips based on subject:
  - English: Argument analysis, Text response, Comparative writing
  - Mathematical Methods: Calculus, Probability, Functions and graphs
  - Software Development: Data design, Algorithms, Testing and evaluation
  - Psychology: Research methods, Learning, Mental wellbeing
  - Chemistry: Equilibrium, Organic chemistry, Reaction pathways
  - Physics: Fields, Motion, Electricity
  - fallback: Key knowledge, Exam revision, Common mistakes
- Difficulty: easy, medium, hard.
- Count: 1, 3, 5.
- Source mode: balanced, exam_bank.
- Visual mode if subject supports visuals: auto, visual.
- Subject tool profile decides calculator/visual hints from `utils/subjectTools.ts`.

Generate/Forge mode:

- Calls app store `generateQuestions`.
- Backend returns `GeneratedQuestion[]`.
- Generated deck displayed in horizontal paging `FlatList`.
- `QuestionCard` shows:
  - marks
  - question text
  - `QuestionVisual`
  - answer input
  - check answer button
  - feedback box with verdict, score, strengths, improvements, next step, XP
  - reveal/hide model answer
  - marking criteria
  - save to saved questions
  - save checked answer as mistake
- Uses `questionWithVisualContext(item)` when saving/checking so visual data is included in question text.
- Cooldown blocks immediate repeated generate for 2.5 seconds.
- `Play battle deck` starts game mode from generated questions.

Battle mode:

- Generates a multiple-choice deck from the same question API.
- Uses supplied `answer_options` if valid, otherwise creates fallback options from model answer plus distractors.
- State:
  - `gameStarted`, `gameIndex`, `gameScore`, `gameStreak`, `gameLives`, `gameCoins`, `timeLeft`
  - powerups: shield, double, hidden options
  - selected option/result/game over
- Each round has 18 seconds.
- Scoring:
  - base points = 100 + remaining time * 5 + current streak * 25
  - double powerup doubles points
  - correct coins = 35 + remaining time + current streak * 5
  - wrong coins = 8
  - wrong loses a life unless shield is active
- Powerups:
  - 50/50 costs 45 coins, hides two wrong options.
  - Shield costs 60 coins.
  - 2x costs 75 coins.
- Game rank:
  - `Mastery run`
  - `Clean win`
  - `Warm-up run`

Saved mode:

- Subject filter uses `filterSubjectId`.
- Search filters question, model answer, topic, subject.
- Shows spaced question queue.
- Uses `utils/spacedReview.ts` with keys `question:<id>`.
- Review quality buttons: Again, Good, Easy.
- `SavedQuestionCard` shows due status, interval, question/model answer.

Tools mode:

Tool segmented buttons:

- `exam`
- `command`
- `calculator` only if selected subject supports calculator
- `mistakes`
- `flashcards`

Exam tool:

- Builds timed mini exam from generated questions.
- Inputs: topic, difficulty, count, time limit minutes.
- Shows question index, total marks, minutes left.
- Student writes answer, clicks `Mark like examiner`.
- Uses same `checkAnswer` API.
- Can save weak exam answer to Mistake Log.

Command Term Trainer:

- Prompts come from `commandTermsForSubject`.
- Subject categories switch command-term sets: maths, sciences, English, technology, arts, languages, VCE VM/VET, humanities/health/business fallback.
- Shows term chips, what marker wants, answer formula, common trap, weak answer, stronger answer, practice question.
- Student answer is checked via `checkAnswer`.
- If verdict is `needs_work` or `close`, automatically saves a mistake-log note.

Calculator tool:

- Renders `ScientificCalculator` for compatible subjects.

Mistakes tool:

- Manual mistake capture:
  - question or weak area
  - what went wrong
  - saves `StudyNote` with `noteType: "mistake_log"` and tag `mistake-log`.
- Lists mistake notes via `isMistakeNote`.
- Can turn a mistake into flashcards using `flashcardsFromNote`.
- Can delete mistake notes.

Flashcard Forge:

- Uses notes that are not flashcards as source material.
- Can forge cards from selected source note or fallback topic support.
- Topic support generates 3 medium questions and stores each as a flashcard.
- Flashcards are `StudyNote`s tagged `flashcard`.
- Review uses spaced repetition keys `flashcard:<id>`.
- Card UI has reveal/hide, Again/Good/Easy, previous/next, delete.

Important tags and helpers:

- `mistakeTag = "mistake-log"`
- `flashcardTag = "flashcard"`
- `formatMistakeNoteBody`, `parseMistakeNote`
- `formatFlashcardNoteBody`, `parseFlashcardNote`
- `flashcardsFromNote`

### Community

File: `app/(tabs)/community.tsx`

Modes:

- `chat`
- `leaderboard`
- `feedback`
- admin-only `users`
- admin-only `analytics`

General:

- Calls `/community`, `fetchAll`, and optionally `/community/analytics`.
- Chat minutes:
  - base 3 per day
  - every 5 study minutes earns 1 more chat minute
  - max daily chat minutes enforced in backend

Chat:

- Scope: all-school chat or subject rooms.
- Subject rooms are derived from user's subjects and stored locally as joined IDs in AsyncStorage.
- Room messages are stored in same table with a hidden marker prefix.
- Admin can delete chat messages.

Leaderboard:

- Opt-in public weekly board.
- Shows privacy notice.
- Weekly rankings show display name, active title, weekly XP, minutes, sessions.
- Admin can resend leaderboard invites.

Feedback:

- Student feedback form categories: feature, bug, content, other.
- Admin sees inbox with sender name/email.

Admin users:

- Admin-only user list with school, XP, levels, subject count, session count, feedback count, chat count.
- Admin can gift and equip themes.

Admin analytics:

- Active now/today/week.
- Tab visits today.
- Study minutes/chat/feedback last 7 days.
- Hourly chart, screen usage, student activity, recent tab visits.

### Shop

File: `app/(tabs)/shop.tsx`

Purpose: spend XP balance/coins on cosmetics.

Modes:

- Themes
- Titles
- Badges

Data:

- Uses local constants `themeShopItems`, `TITLE_SHOP_ITEMS`, `BADGE_SHOP_ITEMS`.
- Uses backend mutations for unlock/apply.

Theme IDs include:

- `midnight`, `mint`, `sunset`, `ocean`, `royal`, `aurora`, `citrus`, `cherry`, `glacier`, `graphite`, `arcade`, `forest`, `rose_gold`, `matrix`, `cherry_blossom`, `spring_picnic`, `summer_glow`, `easter_pastel`, `christmas_lights`, `snow_day`, `pink_cloud`.

`PRO_PLAN_VISIBLE` is currently `false`, so the Pro upsell card does not appear.

### Pro

File: `app/(tabs)/pro.tsx`

- Hidden route.
- `constants/proPlan.ts` sets `PRO_PLAN_VISIBLE = false`.
- If false, route redirects to `/(tabs)/shop`.
- If enabled, it shows Free vs Student Pro waitlist and records interest by sending feedback with `PRO_WAITLIST` content.

### Profile

File: `app/(tabs)/profile.tsx`

Purpose: profile, XP, ATAR projection, subjects/goals, badges, logout.

Major behavior:

- Shows current display name and active title.
- `XPBar` from gamification.
- Adaptive ATAR projection:
  - Uses target study scores.
  - Scales with `constants/atarEstimate.ts`.
  - Adjusts target score per subject based on weekly study hours, previous week trend, study days, and learning evidence count.
  - Warns if no English study is included.
  - Text explicitly says estimate only and uses 2025 VTAC rounded scaling/aggregate thresholds.
- Subject/goals:
  - Max 8 subjects.
  - `GoalCard` per subject.
  - Target score input.
  - Weekly hours stepper +/- 0.5 up to 20.
  - Delete subject confirmation.
- Add subject dialog:
  - Unit segmented control.
  - Subject search grouped by category.
  - Target score and color picker.
- Badges grid.
- Logout clears tokens and routes to login.

## Constants And Domain Data

`constants/vceSubjects.ts`

- Full VCE subject list with categories and units.
- Categories include English, Mathematics, Sciences, Humanities, Technology, The Arts, Languages, Health and PE, VCE VM, VCE VET.

`constants/theme.ts`

- Base palette:
  - background `#0F0F14`
  - surface `#1A1A24`
  - primary `#7C6EFF`
  - secondary `#FF6B6B`
  - success `#4ADE80`
  - warning `#F59E0B`
  - info `#60A5FA`
  - text `#F0F0FF`
  - muted `#8888AA`
- Theme shop items include colors and optional motion types.

`constants/gamification.ts`

- Levels:
  - 1: VCE Rookie, 0 XP
  - 2: On the Grind, 200
  - 3: SAC Survivor, 500
  - 4: Study Machine, 1000
  - 5: ATAR Hunter, 2000
  - 6: VCE Veteran, 3500
  - 7: Rank God, 5500
  - 8: 50 Study Score, 8000
- Badges include first session, early bird, night owl, marathon, streaks, subject master, question king, goal setter, SAC ready, all rounder, and collectible shop badges.
- Starter titles:
  - `vce_rookie`
  - `year_11_rookie`
  - `year_12_rookie`

`utils/subjectTools.ts`

- Determines whether a subject gets calculator/visual support.
- Maths, sciences, data/technology/accounting/economics and related subjects get calculator and/or graph/diagram support.

`utils/spacedReview.ts`

- AsyncStorage key: `vce-study-tracker:spaced-review:v1`.
- Intervals in days: 1, 3, 7, 14, 30, 60.
- Qualities: again, good, easy.

`utils/streaks.ts`

- Uses `Australia/Melbourne`.
- A streak remains active if last study date is today or yesterday in app timezone.

## Backend Architecture

Entry: `backend/src/index.ts`

- Loads env.
- Express app on `PORT || 3000`.
- CORS allowed origins:
  - Netlify production URL
  - `http://localhost:3000`
  - `http://localhost:8081`
  - `http://localhost:19006`
- JSON limit 8mb.
- `GET /health`.
- Mounts routers:
  - `/api/auth`
  - `/api/subjects`
  - `/api/sessions`
  - `/api/events`
  - `/api/goals`
  - `/api/questions`
  - `/api/gamification`
  - `/api/coach`
  - `/api/community`
  - `/api/memory`
- Calls `ensureDatabaseSchema()` before listen.
- Cron at 23:59 Melbourne time calls `resetExpiredStreaks()`.

Auth middleware:

- `requireAuth` validates bearer JWT and puts `user` on request.
- Access token expires in 15m.
- Refresh token expires in 30d.

AI usage limit middleware:

- In-memory per-user and global daily counters.
- Unlimited domains configurable.
- Throws 429 when over limit.

## Backend REST Endpoints

All routes below are prefixed by `/api` unless otherwise noted.

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

Subjects:

- `GET /subjects`
- `POST /subjects`
- `DELETE /subjects/:id`

Sessions:

- `GET /sessions`
- `POST /sessions`
- `GET /sessions/stats`

Events:

- `GET /events`
- `POST /events`
- `PATCH /events/:id`
- `DELETE /events/:id`

Goals:

- `GET /goals`
- `POST /goals`
- `PUT /goals/:id`

Questions:

- `GET /questions/saved`
- `POST /questions/generate`
- `POST /questions/timer-check`
- `POST /questions/save`
- `POST /questions/check-answer`

Coach:

- `GET /coach/daily-inspiration`
- `GET /coach/reflections`
- `POST /coach/reflections`
- `GET /coach/notes`
- `POST /coach/notes`
- `PUT /coach/notes/:id`
- `DELETE /coach/notes/:id`
- `GET /coach/resources`
- `POST /coach/resources/upload`
- `GET /coach/resources/:id`
- `DELETE /coach/resources/:id`
- `POST /coach/notetaker/chunk`
- `POST /coach/notetaker`
- `POST /coach/ask`
- `GET /coach/plans/latest`
- `POST /coach/plans/generate`

Community:

- `GET /community`
- `POST /community/feedback`
- `GET /community/gifts`
- `PATCH /community/gifts/:id/read`
- `POST /community/usage-events`
- `GET /community/analytics` admin only
- `POST /community/leaderboard/resend-invite` admin only
- `GET /community/subject-rooms`
- `GET /community/subject-rooms/:roomId/chat`
- `POST /community/subject-rooms/:roomId/chat`
- `POST /community/chat`
- `DELETE /community/chat/:id` admin only
- `POST /community/users/:id/gifts/theme` admin only

Gamification:

- `GET /gamification`
- `GET /gamification/leaderboard`
- `POST /gamification/leaderboard-preference`
- `POST /gamification/check`
- `GET /gamification/shop`
- `POST /gamification/themes/:themeId/unlock`
- `POST /gamification/themes/:themeId/apply`
- `POST /gamification/titles/:titleId/unlock`
- `POST /gamification/titles/:titleId/apply`
- `POST /gamification/badges/:badgeId/unlock`

Memory:

- `GET /memory/events`
- `GET /memory/signals`
- `GET /memory/student-map`
- `POST /memory/student-map/rebuild`

## Database Models

Prisma file: `backend/src/db/prisma/schema.prisma`

Models:

- `User`: account, school name, avatar, relations.
- `UserSubject`: user's subject, unit, target score, color.
- `StudySession`: duration, notes, XP, optional subject.
- `Event`: SAC/SAT/practice/exam/task/study time/tutor session fields; recurrence; notification; source; Google IDs.
- `Goal`: per subject target study score and weekly hours.
- `UserGamification`: XP, coin balance, level, streaks, badges, unlocked cosmetics, active theme/title, leaderboard opt-in.
- `SavedQuestion`: question, model answer, topic, difficulty, marks, marking criteria.
- `StudyReflection`: class log fields.
- `StudyNote`: title/body/type/tags.
- `StudyResource`: file metadata, source type, extracted text.
- `AdaptiveStudyPlan`: summary, focus areas, tasks, daily plan, subject roadmaps, source events, checkpoints.
- `UserFeedback`: category, message, status.
- `CommunityChatMessage`: chat messages. Subject rooms are encoded by marker prefix in `message`.
- `UserGiftMessage`: theme/leaderboard/admin gift messages.
- `UserUsageEvent`: screen/action analytics.
- `StudentMemoryEvent`: durable event stream of learning activity.
- `LearningSignal`: extracted signal from memory events.
- `StudentSubjectMemory`: aggregated per-subject memory map.

Important delete behavior:

- Most user-owned data cascades on user delete.
- Subject deletion sets many subject relations to null, preserving history in sessions/events/questions/notes/resources where applicable.
- Saved questions persist if a subject is deleted.

## Backend AI Service

File: `backend/src/services/aiService.ts`

Uses OpenAI only if key exists. Otherwise deterministic mock responses are returned.

Structured outputs:

- `GeneratedQuestion`
  - `question`
  - `marks`
  - `topic`
  - `model_answer`
  - `marking_criteria`
  - `answer_options`
  - `visual`
- `GeneratedQuestionVisual`
  - type: `line_graph`, `scatter_plot`, `bar_chart`, `diagram`, `image_prompt`
  - title, description, axis labels, points, bars, labels
- `AnswerFeedback`
  - score, awarded_marks, max_marks
  - verdict: `needs_work`, `close`, `strong`, `excellent`
  - strengths, improvements, next_step
- `AdaptiveStudyPlan`
  - summary, focus_areas, tasks, daily_plan, subject_roadmaps, source_events, checkpoints
- `StudyAnswer`
  - answer, key_points, sources_used, follow_up_questions, tutor_plan, confidence
- `DailyInspiration`
  - quote, tip, action
- `ClassNoteDraft`
  - title, summary, key_points, subject_terms, confusion_flags, questions_to_ask, retrieval_prompts, next_actions
- `ClassNoteChunk`
  - title, summary, bullets, action, confidence
- Learning signals:
  - signal_type, subject, topic, title, detail, evidence, confidence, next_action, weight

AI functions:

- `generateDailyInspiration`
- `generatePracticeQuestions`
- `evaluateStudentAnswer`
- `extractLearningSignalsFromMemoryEvent`
- `generateAdaptiveStudyPlan`
- `transcribeClassAudio`
- `generateClassNotesFromTranscript`
- `generateClassNoteChunkFromTranscript`
- `answerStudyQuestion`

Important AI behavior:

- Practice question generation includes VCE study design context and personal context from notes/resources/reflections/student memory.
- `sourceMode: "exam_bank"` prioritizes exam/practice SAC resources and allows more context.
- Visual question generation is only pushed for visual-friendly subjects/topics.
- Answer marking is strict but encouraging VCE marking.
- Adaptive plan is assessment-first and calendar-driven, using scheduled study blocks if available.
- Ask Coach supports direct mode and tutor mode.
- Ask Coach can use screenshots as image inputs and attached PDFs as extracted text context.
- Word-count requests in Ask Coach are detected and normalized so `answer` contains only the final answer text when applicable.

## Student Memory Pipeline

Files:

- `backend/src/services/studentMemoryService.ts`
- `backend/src/routes/memory.ts`

Pattern:

1. Backend routes call `recordStudentMemory` after meaningful actions:
   - study session completed
   - calendar event created/updated
   - question generated/saved/checked
   - class reflection saved
   - note/mistake saved
   - resource uploaded
   - notetaker saved
   - Ask Coach/tutor turn asked
2. Each memory event stores structured payload and summary.
3. Learning signals are either supplied directly or extracted by AI.
4. `refreshSubjectMemoryMap` aggregates signals into `StudentSubjectMemory`.
5. Student Map displays strengths, weak areas, common mistakes, topics, upcoming assessments, best methods, evidence trail, risk level, and predicted next task.

## Gamification

Files:

- `backend/src/services/gamificationService.ts`
- `backend/src/routes/gamification.ts`
- frontend constants mirror some shop/level data.

Rules:

- Session XP: `Math.floor(durationSeconds / 600) * 10 + 25 if durationSeconds > 3600`.
- Timer can add bonus XP from check-ins.
- Question generation gives 5 XP per generated question.
- Checking an answer gives XP based on score and verdict.
- Calendar event creation gives small XP and badges.
- XP balance is also coin balance for shop unlocks.
- Streak reset job runs at 11:59pm Melbourne time.
- Starter theme: `midnight`.
- Starter active title: `vce_rookie`.
- Leaderboard is opt-in and weekly.

## Resource Extraction

File: `backend/src/services/resourceService.ts`

- Detects PDF, DOCX/DOC, Markdown/text.
- Normalizes whitespace.
- Stores extracted text in DB.
- Provides context snippets and query-centered context snippets for AI prompts.
- PDF extraction uses `pdf-parse`.
- DOCX uses `mammoth`.
- DOC uses `word-extractor`.

## Feature Flags And Hidden Routes

- `PRO_PLAN_VISIBLE = false`, so Pro redirects to Shop.
- `insights` is hidden from tab bar but used as Student Map from Home.
- `pro` is hidden from tab bar.

## Implementation Guidance For Future Changes

Preserve these patterns:

- Use `useAppStore` for app data mutations and `studyApi` for REST calls.
- Use `useFocusEffect` plus `fetchAll()` on screens that need fresh data.
- Use `Screen` and `AppCard` for main UI surfaces.
- Keep mobile/web compatibility in mind. Many features have web-specific branches.
- Use existing tags and note body formats for mistakes/flashcards/coach answers. Other screens parse these strings.
- Use `questionWithVisualContext` whenever a generated question with a visual is saved or checked.
- Keep subject deletion behavior non-destructive from the user's perspective.
- When adding AI features, add backend route/method, zod schema, mock fallback, memory event, and app store wrapper.
- When adding data needed across screens, update `types/index.ts`, `studyApi`, and `appStore.fetchAll()` if appropriate.
- Be careful with hardcoded `palette` versus active theme. Existing code often uses `palette`; new shared UI should prefer active theme only if it fits surrounding style.
- For calendar-driven planning, keep `utils/studyEvents.ts` recurrence expansion and tutor-session detection intact.
- For questions/tools, respect `PracticeTool` modes and existing state names rather than splitting into unrelated stores unless necessary.

## Important Files To Inspect Before Editing

For route/screen changes:

- `app/(tabs)/questions.tsx`
- `app/(tabs)/study.tsx`
- `app/(tabs)/calendar.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/community.tsx`
- `app/(tabs)/profile.tsx`
- `app/(tabs)/insights.tsx`

For shared data/API changes:

- `types/index.ts`
- `services/studyApi.ts`
- `store/appStore.ts`
- `services/api.ts`

For AI/backend changes:

- `backend/src/routes/questions.ts`
- `backend/src/routes/coach.ts`
- `backend/src/services/aiService.ts`
- `backend/src/services/studentMemoryService.ts`
- `backend/src/services/gamificationService.ts`
- `backend/src/db/prisma/schema.prisma`

For study-specific parsing/UI behavior:

- `utils/vceCoach.ts`
- `utils/spacedReview.ts`
- `utils/subjectTools.ts`
- `utils/studyEvents.ts`
- `components/session/StudyAskCard.tsx`
- `components/session/StudyCoachPanel.tsx`
- `components/session/StudyNotesPanel.tsx`
- `components/session/StudyResourcesPanel.tsx`

