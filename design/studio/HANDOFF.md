# Studio redesign — implementation handoff

Mockups: `design/studio/Main.dc.html` (Interview) and `design/studio/Chapters.dc.html` (Chapters).
They are static HTML mockups with inline styles. The `<x-dc>`, `<sc-for>`, `<sc-if>`, `{{…}}` and the
`<script type="text/x-dc">` block are mockup tooling. Read them for layout, sizes and colors only; never copy
that syntax into the app. Sample text in brackets and all counts are placeholders.

Scope: restyle and relayout `components/SessionScreen.tsx`, `components/ChaptersView.tsx`,
`components/HeaderNav.tsx`, `app/layout.tsx` (header), `app/globals.css`. Keep every existing behavior
and API call. Review and Intake only need the new tokens and fonts so they don't break visually; don't
redesign them.

## Tokens (replace the current palette in globals.css; dark only for now)

| token | value | use |
|---|---|---|
| paper (ground) | #141516 | page background |
| card | #1a1c1e | composer card, consolidation card |
| card-raised | #1c1e20 | secondary pill buttons |
| card-active | #1f2224 | active TOC row |
| border | #2c2f32 | dividers, card borders |
| border-strong | #3a3e42 | outline buttons, dashed photo button |
| ink | #ece8e1 | primary text |
| ink-prose | #ddd8cf | chapter prose |
| ink-mid | #d6d1c9 | secondary button text |
| ink-soft | #a8a39b | labels, meta |
| ink-faint | #8a857e | captions, placeholders (keep ≥ this for contrast) |
| accent | #6fb3a8 (teal) | record button, primary buttons, active nav underline, "new" counts |
| on-accent | #141516 | text/icons on accent fills |
| accent-glow | accent at 12–18% alpha | ring around record button and logo dot |

Keep `--record` for error text.

## Type (next/font/google, replacing Newsreader / Work Sans)

- Archivo (variable, use `axes: ["wdth"]`): UI and headings. The wordmark is 700 at `font-stretch:125%` with
  0.08em tracking. The question is 46px/1.12, weight 500, `font-stretch:92%`, max-width 24ch. The chapter
  title is 64px/1.02, weight 600, `font-stretch:88%`.
- Source Serif 4: the answer textarea (20px/1.6), chapter prose (20px/1.7, max 64ch, 26px paragraph gap)
  and session log answers (16px).
- JetBrains Mono: small uppercase meta labels at 11–12px with 0.08em tracking.

## Interview (SessionScreen)

- Two columns: main `flex: 999 1 560px` and rail `flex: 1 1 300px`, gap 56, max-width 1280, padding
  56/40. They wrap to one column on a phone.
- Above the question, a meta line: `QUESTION NN · <period label> / <theme label>`. Take the labels from
  `pending.targetPeriodId` (map it through the coverage map periods) and `THEME_LABELS[pending.targetTheme]`.
  NN is the count of this session's fragments + 1. Hide the line in directed mode.
- Below the question, two pill buttons: **Save for later** (the existing `saveForLater`) and **New topic**
  (the existing `newTopic`), with the hint "· sets this period aside a week".
- Composer card:
  - Top row: a 72px round accent mic button (restyle VoiceRecorder's trigger, but keep its logic) with
    "Tap to talk" and a helper line, and a dashed "Attach a photo" button (PhotoAttach).
  - Middle: a "YOUR ANSWER" label over a borderless serif textarea.
  - Bottom row: a "Something else on my mind →" text button and an accent "Save answer" button.
- Rail:
  - "THIS SESSION": `sessionFragments`, newest first. Each entry shows a mono tag (number · period ·
    theme, or "YOUR OWN TOPIC" when selfDirected), the question in ink-soft, and `cleanedText` in serif.
    This replaces the chat bubbles.
  - "SAVED FOR LATER (n)": each saved question has "Answer now →" and "Discard". This needs a list
    endpoint or a reuse of the current saved-questions fetch. Today only one saved question is pulled at
    a time, so check the API before building, and keep the current single-pull flow if a list isn't
    cheap to add.
- Header: the session count ("3 FRAGMENTS THIS SESSION") and **Finished** sit on the right of the global
  header on the Interview route only. If lifting that state is messy, keep them at the top of
  SessionScreen.
- Keep the followUp "back to today's regular questions" link, the viewingSaved banner and the done screen.
  Restyle them with the new tokens.

## Chapters (ChaptersView)

- Two columns: a contents sidebar (`flex: 1 1 300px`) and a reading column (`flex: 999 1 560px`,
  max 720), gap 64.
- Sidebar:
  - Top: the consolidation card, with a mono accent line "N NEW FRAGMENTS WAITING", a short explainer,
    and a full-width accent "Run consolidation" button (the existing `runConsolidation` and status/error
    messages).
  - Below: CONTENTS, one row per life period in order. Each row shows the mono number, the label, and a
    meta line ("N fragments" or "No chapter yet") plus "+N new" in accent. The selected row gets the
    card-active background.
- Reading column: one chapter at a time, selected from the TOC (keep it in client state or a `?p=`
  query param). It has a mono kicker ("CHAPTER 04 · <period label>"), the big title, and a meta row
  ("Woven from N fragments · Updated <date> · N new fragments not yet woven in"). Below that sit the
  prose paragraphs (split on blank lines, as now) and a prev/next footer.
- "N new" per period = fragments with that `periodId` whose id is not in `chapter.fragmentIds`. The
  fragments are already readable via the existing fragments API. If that API is heavy, add a small
  `/api/chapters` field for it.
- Periods with no chapter yet still show in the TOC. Selecting one shows an empty state with its
  fragment count.

## Don't

- Don't change storage, API routes or prompts beyond what's needed for the counts above.
- No left-border accent cards and no gradients. Touch targets must be at least 44px.
