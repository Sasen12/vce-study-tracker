# VCE Study Tracker

A full-stack Expo + Node.js study app for Australian VCE Year 12 students. It includes dark-mode mobile screens, JWT auth, study timers, SAC/exam tracking, OpenAI-powered practice questions, adaptive study plans, notes, textbook/Obsidian context upload, goals, XP, streaks, badges, and a chess break mode.

## Stack

- Expo SDK 51, Expo Router, React Native Paper, Reanimated, React Native Calendars, Gifted Charts, Zustand, SecureStore
- Node.js, Express, Prisma, PostgreSQL, JWT, bcryptjs, OpenAI API

## Quick Start

One-command launch on Windows:

```powershell
npm run launch
```

This starts Postgres with Docker Compose, prepares Prisma, starts the backend, then launches Expo web. Use `.\launch.ps1 -SkipDocker`, `-SkipInstall` or `-SkipPrisma` if you already have those pieces running.

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Start PostgreSQL:

```bash
cd ..
docker compose up -d
```

4. Configure backend env:

```bash
cd backend
copy .env.example .env
```

Set `OPENAI_API_KEY` for real generation. `OPENAI_MODEL` defaults to `gpt-5.4-mini`. If the key is left as the placeholder, the backend returns mock VCE-style JSON so the mobile UI can still be tested.

5. Create tables and seed the demo account:

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
```

Clean starter login:

```text
demo@vcestudy.app
password123
```

The starter account has English, Software Development, Data Analytics, Business Management and General Mathematics only. It has no fake sessions, events, saved questions or badges.

6. Run the backend:

```bash
npm run dev
```

7. In another terminal, run Expo:

```bash
cd ..
npm run start
```

## Mobile API URL

The frontend reads `EXPO_PUBLIC_API_URL` from the root `.env`.

```text
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For a physical phone using Expo Go, replace `localhost` with your computer's LAN IP. For an Android emulator, `http://10.0.2.2:3000/api` is often the right value.

## Backend Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/subjects`
- `POST /api/subjects`
- `DELETE /api/subjects/:id`
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/stats`
- `GET /api/events`
- `POST /api/events`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `GET /api/goals`
- `POST /api/goals`
- `PUT /api/goals/:id`
- `GET /api/questions/saved`
- `POST /api/questions/generate`
- `POST /api/questions/check-answer`
- `POST /api/questions/save`
- `GET /api/coach/reflections`
- `POST /api/coach/reflections`
- `GET /api/coach/notes`
- `POST /api/coach/notes`
- `PUT /api/coach/notes/:id`
- `DELETE /api/coach/notes/:id`
- `GET /api/coach/resources`
- `POST /api/coach/resources/upload`
- `DELETE /api/coach/resources/:id`
- `GET /api/coach/plans/latest`
- `POST /api/coach/plans/generate`
- `GET /api/gamification`
- `POST /api/gamification/check`

## Study Coach

- The Study tab has Coach, Notes, Files, Timer and Chess modes.
- Coach mode lets you log what happened in class, what made sense, what did not click, and the next move. The backend combines those reflections with upcoming events, recent sessions, notes and uploaded resources to generate an adaptive plan.
- Notes mode is simple for most subjects. General Mathematics gets structured note templates for worked examples, formulas and mistake logs.
- Files mode accepts textbook PDFs and Obsidian Markdown files. The backend extracts text and stores it as private study context for plan and question generation.

## Notes

- Streak reset runs at 11:59pm Melbourne time using `Australia/Melbourne`, including automatic daylight savings changes.
- Saved questions use `ON DELETE SET NULL` for `subject_id`, so they persist if a subject is deleted.
- The ATAR widget is intentionally a rough estimator. Official scaling and aggregate conversion changes each year.
- VCAA study design DOCX files are stored in `backend/src/resources/study-designs`, with concise subject context used by the question generator.
- Chess break mode uses `chess.js` for legal move validation.
