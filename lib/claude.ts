import Anthropic from "@anthropic-ai/sdk";
import {
  INTAKE_CATEGORY_LABELS,
  THEME_LABELS,
  type Chapter,
  type CoverageMap,
  type Fragment,
  type IntakeCategory,
  type LifePeriod,
  type LifeSkeleton,
  type ThemeKey,
} from "./types";
import { pickNextTarget } from "./coverage";
import { summarizeSkeleton, type SkeletonFacts } from "./skeleton";

const MODEL = "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

const PROBING_CATEGORIES = [
  "Relationships and people",
  "Daily life and routines",
  "Formative or turning-point moments",
  "Beliefs/feelings at the time vs. now",
  "Regrets or things he'd do differently",
  "Sensory or place-based detail",
];

export interface GeneratedQuestion {
  question: string;
  targetPeriodId: string;
  targetTheme: ThemeKey;
}

/**
 * Generates the next question by targeting the thinnest-covered
 * (life period, theme) combination, in the voice of a patient, curious
 * biographer working from a real probing-category checklist rather than
 * generic "tell me more" prompts.
 */
export async function generateQuestion(
  coverageMap: CoverageMap,
  recentFragments: Fragment[],
  skeleton: LifeSkeleton,
  excludePeriodId?: string,
  recentQuestions?: string[]
): Promise<GeneratedQuestion> {
  const target = pickNextTarget(coverageMap, excludePeriodId);
  if (!target) {
    throw new Error("No coverage target available - all periods/themes tapered off");
  }
  const period = coverageMap.periods.find((p: LifePeriod) => p.id === target.periodId);
  const themeLabel = THEME_LABELS[target.theme];
  const isNewBranch = Boolean(excludePeriodId) && target.periodId !== excludePeriodId;

  const recentContext = recentFragments
    .slice(0, 8)
    .map((f) => `- (${f.periodId}/${f.theme}) ${f.cleanedText}`)
    .join("\n");
  const recentQuestionsList = (recentQuestions ?? []).filter(Boolean);

  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are a patient, curious biographer interviewing someone about their life, " +
      "one question at a time. You favor gap-filling over thread-following: you're " +
      "given a specific life period and theme that's thinly covered so far, and your " +
      "job is to ask ONE good, specific, open-ended question that draws out real detail " +
      "in that area. Draw on categories like: " + PROBING_CATEGORIES.join(", ") + ". " +
      "Nothing is taboo - heavy or sensitive territory is high-value, not to be avoided. " +
      "You have standing background context (the life skeleton) - use it to ask sharper, " +
      "better-anchored questions (e.g. referencing a known relationship or place by name) " +
      "rather than generic ones, and trust it over any assumption you might otherwise make " +
      "(e.g. don't guess at circumstances the skeleton already states). If relevant, you " +
      "may reference a past fragment to draw a connection, but the question must still " +
      "center on the target period/theme. Never repeat or closely reword a recently-asked " +
      "question - if one of the recent questions listed already covers this angle, find a " +
      "genuinely different one. Return ONLY the question text, no preamble, no quotation marks.",
    messages: [
      {
        role: "user",
        content:
          `Life skeleton (standing context):\n${summarizeSkeleton(skeleton)}\n\n` +
          `Target life period: ${period?.label ?? target.periodId}\n` +
          `Target theme: ${themeLabel}\n\n` +
          (recentContext
            ? `Recent fragments for context (most recent first):\n${recentContext}\n\n`
            : "") +
          (recentQuestionsList.length > 0
            ? `Questions already asked recently - do not repeat or closely reword any of these:\n${recentQuestionsList.map((q) => `- ${q}`).join("\n")}\n\n`
            : "") +
          (isNewBranch
            ? "The person explicitly asked to move on to a completely different part of their " +
              "life - ask a question that clearly signals a fresh start, not a continuation of " +
              "whatever came before.\n\n"
            : "") +
          "Ask the next question.",
      },
    ],
  });

  const text = msg.content.find((b) => b.type === "text");
  const question = text && text.type === "text" ? text.text.trim() : "Tell me about that time in your life.";

  return { question, targetPeriodId: target.periodId, targetTheme: target.theme };
}

/**
 * Generates a natural follow-up on a thread Scott started himself, rather
 * than gap-filling. Used when the most recent fragment was self-directed -
 * the biographer follows the thread instead of steering back to whatever
 * the coverage map thinks is thinnest.
 */
export async function generateFollowUpQuestion(
  lastFragment: Fragment,
  skeleton: LifeSkeleton,
  recentQuestions?: string[]
): Promise<string> {
  const recentQuestionsList = (recentQuestions ?? []).filter(Boolean);
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are a patient, curious biographer. The person just went off on a topic of their " +
      "own choosing rather than answering a planned question - your job now is to follow " +
      "that thread, not steer back to something unrelated. Ask ONE natural, curious " +
      "follow-up that goes deeper into what they just shared (more detail, a related " +
      "person or moment, how they felt about it). You may draw on the life skeleton for " +
      "context if it helps sharpen the question. Never repeat or closely reword a " +
      "recently-asked question. Nothing is taboo. Return ONLY the question text, no " +
      "preamble, no quotation marks.",
    messages: [
      {
        role: "user",
        content:
          `Life skeleton (standing context):\n${summarizeSkeleton(skeleton)}\n\n` +
          `What they just shared:\n${lastFragment.cleanedText}\n\n` +
          (recentQuestionsList.length > 0
            ? `Questions already asked recently - do not repeat or closely reword any of these:\n${recentQuestionsList.map((q) => `- ${q}`).join("\n")}\n\n`
            : "") +
          "Ask a follow-up that stays on this thread.",
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : "Tell me more about that.";
}

/**
 * Removes disfluencies (filler words, false starts, trailing-off) only.
 * Does NOT rewrite phrasing, word choice, or sentence rhythm - the goal is
 * a tidied transcript, not a ghostwritten paraphrase.
 */
export async function cleanupTranscript(rawText: string): Promise<string> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "You clean up spoken/written transcripts by removing disfluencies ONLY: " +
      "filler words (um, uh, like), false starts, restarts, and trailing-off " +
      "fragments. Do NOT rewrite, smooth, rephrase, or improve the person's actual " +
      "word choice, phrasing, or sentence rhythm - preserve their authentic voice " +
      "exactly as spoken, just tidied. Return ONLY the cleaned text, nothing else.",
    messages: [{ role: "user", content: rawText }],
  });
  const text = msg.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : rawText;
}

export interface InferredTags {
  periodId: string;
  theme: ThemeKey;
}

const TAG_TOOL: Anthropic.Tool = {
  name: "tag_fragment",
  description: "Tag a journal fragment with its inferred life period and theme.",
  input_schema: {
    type: "object",
    properties: {
      periodId: { type: "string", description: "The id of the best-matching life period." },
      theme: {
        type: "string",
        enum: Object.keys(THEME_LABELS),
        description: "The best-matching theme category.",
      },
    },
    required: ["periodId", "theme"],
  },
};

/**
 * Infers which life period and theme a fragment belongs to, from context
 * clues in the text itself (age, school, job, location mentioned) - the
 * question's target is a starting hint, not ground truth, since answers
 * often wander.
 */
export async function inferTags(
  cleanedText: string,
  periods: LifePeriod[],
  hint: { periodId: string; theme: ThemeKey },
  skeleton: LifeSkeleton
): Promise<InferredTags> {
  const client = getClient();
  const periodList = periods.map((p) => `- ${p.id}: ${p.label}`).join("\n");

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    tools: [TAG_TOOL],
    tool_choice: { type: "tool", name: "tag_fragment" },
    system:
      "You tag journal fragments with the life period and theme they actually belong to, " +
      "based on context clues in the text (age, school, job, location mentioned) - not " +
      "just the question that prompted it, since answers often wander to a different period. " +
      "Use the life skeleton as standing context: e.g. if a named person or place is " +
      "mentioned that the skeleton already places in a specific era, use that to place the " +
      "fragment confidently instead of guessing from the fragment alone.",
    messages: [
      {
        role: "user",
        content:
          `Life skeleton (standing context):\n${summarizeSkeleton(skeleton)}\n\n` +
          `Known life periods:\n${periodList}\n\n` +
          `The question asked was aimed at period "${hint.periodId}" / theme "${hint.theme}", ` +
          "but tag based on what the fragment actually describes.\n\n" +
          `Fragment text:\n${cleanedText}`,
      },
    ],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as InferredTags;
    return { periodId: input.periodId, theme: input.theme };
  }
  return hint;
}

const TAPER_TOOL: Anthropic.Tool = {
  name: "assess_taper",
  description:
    "Assess whether the person has tapped out on this life-period/theme combination - either " +
    "explicitly saying so, or implicitly by circling the same ground already covered.",
  input_schema: {
    type: "object",
    properties: {
      taperedOff: {
        type: "boolean",
        description:
          "True only if the person explicitly signals they're done with this topic, or their " +
          "new answer is substantially just repeating the prior answers with no real new detail.",
      },
    },
    required: ["taperedOff"],
  },
};

/**
 * Judges whether a fragment signals the person is tapped out on this
 * (period, theme) cell - explicitly ("that's about it, not much happened
 * there") or implicitly (circling the same ground as recent answers on
 * this same cell, no new detail). Distinguishing "thin because unasked"
 * from "thin because there's just not much there" is what lets the
 * question engine back off instead of getting stuck probing a cell that's
 * genuinely exhausted.
 */
export async function assessTaper(cleanedText: string, priorFragmentsForCell: Fragment[]): Promise<boolean> {
  // Nothing to compare against yet - never taper on the first fragment in a cell.
  if (priorFragmentsForCell.length === 0) return false;

  const client = getClient();
  const priorContext = priorFragmentsForCell.map((f) => `- ${f.cleanedText}`).join("\n");

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    tools: [TAPER_TOOL],
    tool_choice: { type: "tool", name: "assess_taper" },
    system:
      "You judge whether someone is tapped out on a topic they've been asked about repeatedly. " +
      "Genuinely new detail, a new angle, or a new sub-story on the same general subject is NOT " +
      "tapered - people can have a lot to say about one thing. Only call it tapered when the new " +
      "answer adds essentially nothing beyond what's already captured, or the person says " +
      "something like 'that's about it' / 'not much else happened there' / 'I've told you " +
      "everything I remember'. Default to false when in doubt - false is the safe default, since " +
      "over-probing beats wrongly cutting someone off.",
    messages: [
      {
        role: "user",
        content:
          `Prior answers already captured for this period/theme (most recent first):\n${priorContext}\n\n` +
          `New answer:\n${cleanedText}`,
      },
    ],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    return Boolean((toolUse.input as { taperedOff: boolean }).taperedOff);
  }
  return false;
}

/**
 * Generates the next intake question for the given skeleton category,
 * informed by what's already captured so it doesn't re-ask for things it
 * already knows. This runs before normal deep-probing questions begin -
 * the goal is a rough scaffold (fuzzy dates are fine), not deep detail.
 */
export async function generateIntakeQuestion(
  skeleton: LifeSkeleton,
  category: IntakeCategory
): Promise<string> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You are a patient biographer doing a quick intake pass before deep interviewing " +
      "begins - like getting the basic skeleton of someone's life before probing into " +
      "detail. Ask ONE light, open question to gather rough, approximate information for " +
      "the target category below. Fuzzy dates and rough answers are totally fine - do not " +
      "press for precision. Don't re-ask for anything already captured in the skeleton. " +
      "Return ONLY the question text, no preamble, no quotation marks.",
    messages: [
      {
        role: "user",
        content:
          `Life skeleton captured so far:\n${summarizeSkeleton(skeleton)}\n\n` +
          `Target category: ${INTAKE_CATEGORY_LABELS[category]}\n\n` +
          "Ask the next intake question for this category.",
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : "Tell me a bit about that.";
}

const SKELETON_FACTS_TOOL: Anthropic.Tool = {
  name: "record_skeleton_facts",
  description:
    "Record rough life-skeleton facts mentioned in an intake answer. Only include facts " +
    "actually stated - do not invent anything. Approximate/fuzzy dates are fine (a year, " +
    "a season, 'early twenties', etc.) - use whatever granularity the person gave.",
  input_schema: {
    type: "object",
    properties: {
      birthDate: { type: "string", description: "Birth date, as precisely as stated." },
      birthPlace: { type: "string", description: "Birthplace, as stated." },
      locations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            place: { type: "string" },
            approxStart: { type: "string" },
            approxEnd: { type: "string" },
          },
          required: ["place"],
        },
      },
      relationships: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string", description: "e.g. spouse, long-term partner" },
            approxStart: { type: "string" },
            approxEnd: { type: "string" },
            notes: { type: "string" },
          },
          required: ["name", "type"],
        },
      },
      transitions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            approxDate: { type: "string" },
          },
          required: ["description"],
        },
      },
    },
  },
};

/**
 * Extracts life-skeleton facts from an answer via tool use. Used both
 * during intake and on every regular fragment afterward - important facts
 * often surface well after intake (e.g. "kept the house and kids" coming
 * up in a later answer), and the skeleton needs to stay current rather
 * than frozen at whatever was captured on day one.
 */
export async function extractSkeletonFacts(cleanedText: string): Promise<SkeletonFacts> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    tools: [SKELETON_FACTS_TOOL],
    tool_choice: { type: "tool", name: "record_skeleton_facts" },
    system:
      "Extract rough life-skeleton facts from this answer: birth info, places lived with " +
      "rough date ranges, key relationships with rough eras, and major life transitions or " +
      "standing circumstances worth remembering (e.g. who kept the house/custody after a " +
      "divorce, a major change in living situation). Only extract what's actually stated - " +
      "do not infer or guess. Leave fields out entirely if not mentioned.",
    messages: [{ role: "user", content: cleanedText }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    return toolUse.input as SkeletonFacts;
  }
  return {};
}

/**
 * Weaves fragments into a chapter's prose. If existingChapter is given, the
 * new fragments are integrated into it - extending and revising transitions
 * as needed, but preserving what's already there rather than rewriting
 * wholesale (regeneration is incremental, not a full rewrite every pass).
 * Otherwise drafts the chapter fresh from newFragments alone.
 */
export async function consolidateChapter(
  existingChapter: Chapter | null,
  newFragments: Fragment[],
  periodLabel: string,
  skeleton: LifeSkeleton
): Promise<string> {
  const client = getClient();
  const fragmentBlock = newFragments
    .map((f) => `- [${THEME_LABELS[f.theme]}] ${f.cleanedText}`)
    .join("\n");

  const system =
    "You are weaving raw journal fragments into a chapter of someone's life story - the kind " +
    "of clean, seamless prose a good memoir reads as. No footnotes, no citations back to " +
    "fragments, no section headers or meta-commentary about the process. Preserve the " +
    "person's authentic voice and phrasing already reflected in the fragments (they've " +
    "already had filler words removed, not been paraphrased) rather than smoothing it into " +
    "generic writing. Don't pad for length or trim to hit a target - let the material set " +
    "the length. Nothing is taboo - write honestly, including heavy or difficult material, " +
    "with the same honesty as the person's own account. Where fragments don't perfectly " +
    "agree, write the most coherent read rather than flagging the discrepancy in the text. " +
    "Return ONLY the chapter prose, nothing else - no title, no preamble.";

  const userContent = existingChapter
    ? `Life skeleton (standing context):\n${summarizeSkeleton(skeleton)}\n\n` +
      `Chapter: ${periodLabel}\n\n` +
      `Existing chapter text:\n${existingChapter.content}\n\n` +
      `New fragments to weave in:\n${fragmentBlock}\n\n` +
      "Integrate the new material into the existing chapter above. Extend it and revise " +
      "transitions where needed so the new material fits naturally, but preserve the " +
      "existing text's content and wording rather than rewriting it wholesale. Return the " +
      "complete updated chapter."
    : `Life skeleton (standing context):\n${summarizeSkeleton(skeleton)}\n\n` +
      `Chapter: ${periodLabel}\n\n` +
      `Fragments:\n${fragmentBlock}\n\n` +
      "Draft this chapter from the fragments above.";

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const text = msg.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : existingChapter?.content ?? "";
}
