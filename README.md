# Biographer

A patient, curious biographer that interviews you a little at a time and, over
time, weaves the fragments into a life story. See the concept spec (Notion)
for the full design rationale.

This is the initial scaffold: a one-time intake step gathers a rough life
skeleton (birth info, key locations, key relationships, major transitions)
before deep-probing questions begin, so the question engine and tagging have
standing context instead of guessing blind. After intake, the daily-question
loop (ask → answer by voice or text → cleanup → tag → save fragment → update
coverage map) is wired end-to-end. Scott can also steer the conversation
himself ("Something else on my mind →") instead of answering the engine's
question - once he does, the next question follows up on his topic instead
of snapping back to gap-filling, until he clicks back to regular questions.
The review feed and chapters viewer are real routes reading live data. The
consolidation pass (fragments → narrative chapters) is not built yet - the
spec marks it "to be detailed further."

## Stack

- Next.js (App Router, TypeScript) - deploys to Vercel
- Claude API (Anthropic) - question generation, tag inference, transcript cleanup
- Gemini API (Google AI Studio) - speech-to-text for voice answers, via native audio understanding
- Google Drive - storage for fragments, coverage map, and (later) chapters. No database.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Anthropic API key

Create a key at https://console.anthropic.com/settings/keys.

### 3. Gemini API key (for speech-to-text)

Create a key at https://aistudio.google.com/apikey. This is a separate key
from the OAuth client in the next step - it authenticates API calls, not
your Drive access.

### 4. Google Drive setup

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

### 5. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
cp .env.local.example .env.local
```

- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - from step 4
- `AUTH_SECRET` - generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - `http://localhost:3000` for local dev

### 6. Run

```bash
npm run dev
```

Visit http://localhost:3000, sign in with Google, and answer the first
question. A `Biographer Data` folder will be created in your Drive
automatically on first sign-in.

## Data model

Everything is stored as JSON files in Drive - no database:

- `Biographer Data/fragments/{id}.json` - one file per fragment (raw text,
  cleaned text, inferred period/theme tags, source question)
- `Biographer Data/coverage-map.json` - tracks which (life period, theme)
  combinations are thin vs. well-covered, steering future questions
- `Biographer Data/skeleton.json` - the rough life skeleton gathered during
  intake (birth info, locations, relationships, transitions); once
  `completedAt` is set, the app moves from intake into normal daily questions
- `Biographer Data/chapters/` - reserved for the consolidation pass (not
  built yet)

## Not yet built

- Consolidation pass (fragments -> narrative chapters)
- Automatic post-session fragment splitting for multi-topic sessions (each
  answer currently becomes one fragment; the spec's fuller design lets one
  continuous conversation get split into several fragments after the fact)
- Timeline correction / review view for blurry dates
- Capacitor wrap for Android/iOS app-store distribution
