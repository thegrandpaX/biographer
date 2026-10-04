# Biographer

A patient, curious biographer that interviews you a little at a time and, over
time, weaves the fragments into a life story. See the concept spec (Notion)
for the full design rationale.

This is the initial scaffold: a one-time intake step gathers a rough life
skeleton (birth info, key locations, key relationships, major transitions)
before deep-probing questions begin, so the question engine and tagging have
standing context instead of guessing blind. That skeleton isn't frozen after
intake either - important facts that surface later in regular answers (e.g.
"kept the house and kids" coming up well after the divorce was first
mentioned) get promoted into it too. The engine also checks recently-asked
questions before firing the next one - logged as soon as a question is
shown (not just once it's answered), so revisiting or reloading the
Interview page without answering doesn't slip past that check and produce
a reworded repeat. After intake, the daily-question
loop (ask → answer by voice or text → cleanup → tag → save fragment → update
coverage map) is wired end-to-end. The engine also backs off a period/theme
once it's tapped out - explicitly signaled ("that's about it") or implicitly
(the last couple answers there are just circling the same ground) - instead
of continuing to target it as thin. Scott can also steer the conversation
himself ("Something else on my mind →") instead of answering the engine's
question - once he does, the next question follows up on his topic instead
of snapping back to gap-filling, until he clicks back to regular questions.
"New topic" sets the current life period aside for a week (stored on the
period in `coverage-map.json` as `snoozedUntil`), so a subject he isn't ready
to talk about doesn't keep resurfacing as the thinnest gap; fragments from
that period are also kept out of the next prompt's context. If every period
is snoozed the engine ignores the snooze rather than running dry.
He can also attach a photo to whatever he's answering (e.g. a picture tied
to that specific memory), stored in Drive and shown as a thumbnail in the
review feed. The review feed and chapters viewer are real routes reading
live data.

The consolidation pass now exists too, as a first pass: a manual "Run
consolidation" button on the Chapters page weaves fragments into one prose
chapter per life period. Regeneration is incremental - a chapter already on
record gets new material integrated into it rather than rewritten from
scratch, so wording that's already there survives later passes. It doesn't
flag conflicting fragments in the prose; Scott catches anything off during
his own read-through and corrects it at the fragment level. Not yet
automatic/volume-based (the spec's actual target) - that layers on once the
prose quality is proven out - and a chapter currently only draws from
fragments tagged to its own period, not fragments from other periods that
happen to comment back on it (spec's fuller vision, deferred for now).

## Stack

- Next.js (App Router, TypeScript) - deploys to Vercel
- Claude API (Anthropic) - question generation, tag inference, transcript cleanup
- Browser's built-in Web Speech API - speech-to-text for voice answers, client-side, free, live (no API key or account needed). Works in Chrome/Edge; not supported in Firefox (falls back to typing). Swappable later for a paid provider (e.g. OpenAI Whisper, Deepgram) by replacing `components/VoiceRecorder.tsx` - it's the only place STT logic lives.
- Google Drive - storage for fragments, coverage map, and (later) chapters. No database.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Anthropic API key

Create a key at https://console.anthropic.com/settings/keys.

### 3. Google Drive setup

The app needs a Google OAuth client so it can create a "Biographer Data"
folder in your Drive and read/write fragment files there. It only requests
the `drive.file` scope, meaning it can only see files it creates itself - not
your whole Drive.

1. Go to https://console.cloud.google.com/ and create a new project (or reuse one).
2. Go to **APIs & Services > Library**, search for "Google Drive API", and enable it.
3. Go to **APIs & Services > OAuth consent screen**. Choose **External**, fill in
   the required fields (app name, your email). You can leave it in "Testing"
   mode and add your own Google account as a test user - no need to publish
   or verify it for personal use.
4. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
     (add your production URL's equivalent once deployed, e.g.
     `https://yourapp.vercel.app/api/auth/callback/google`)
5. Copy the generated **Client ID** and **Client Secret**.

### 4. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

- `ANTHROPIC_API_KEY`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - from step 3
- `AUTH_SECRET` - generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - `http://localhost:3000` for local dev

### 5a. One-click launch (Windows)

Double-click `Biographer.vbs` (or the "Biographer" desktop shortcut). It starts
the dev server in the background, opens the app in its own Edge app window
(no tabs or address bar), and stops the server when you close the window. It
runs from wherever the project folder lives, so make sure the shortcut points
at the copy you're actually editing. Sign in with Google once; the window keeps
its own profile, so the sign-in and mic permission are remembered.

### 5. Run

```bash
npm run dev
```

Visit http://localhost:3000, sign in with Google, and answer the first
question. A `Biographer Data` folder will be created in your Drive
automatically on first sign-in.

## Data model

Everything is stored as files in Drive - no database:

- `Biographer Data/fragments/{id}.json` - one file per fragment (raw text,
  cleaned text, inferred period/theme tags, source question, attached photo IDs)
- `Biographer Data/coverage-map.json` - tracks which (life period, theme)
  combinations are thin vs. well-covered, steering future questions
- `Biographer Data/skeleton.json` - the rough life skeleton gathered during
  intake (birth info, locations, relationships, transitions); once
  `completedAt` is set, the app moves from intake into normal daily questions
- `Biographer Data/saved-questions.json` - questions Scott set aside to
  answer later instead of now, surfaced only when he chooses to pull one up
- `Biographer Data/photos/` - images attached to fragments, served back
  through `/api/photos/[id]` rather than made public
- `Biographer Data/chapters/{periodId}.json` - one consolidated chapter per
  life period (title, prose content, the fragment IDs already woven in)

## Not yet built

- Automatic/volume-based consolidation trigger (currently a manual button)
- Cross-period fragment matching in consolidation (a fragment from one
  period commenting back on another only shows up in its own chapter for now)
- Automatic post-session fragment splitting for multi-topic sessions (each
  answer currently becomes one fragment; the spec's fuller design lets one
  continuous conversation get split into several fragments after the fact)
- Timeline correction / review view for blurry dates
- Capacitor wrap for Android/iOS app-store distribution
