import Anthropic from "@anthropic-ai/sdk";
import {
  INTAKE_CATEGORY_LABELS,
  THEME_LABELS,
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
  skeleton: LifeSkeleton
): Promise<GeneratedQuestion> {
  const target = pickNextTarget(coverageMap);
  if (!target) {
    throw new Error("No coverage target available - all periods/themes tapered off");
  }
  const period = coverageMap.periods.find((p: LifePeriod) => p.id === target.periodId);
  const themeLabel = THEME_LABELS[target.theme];

  const recentContext = recentFragments
    .slice(0, 8)
    .map((f) => `- (${f.periodId}/${f.theme}) ${f.cleanedText}`)
    .join("\n");

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
      "rather than generic ones. If relevant, you may reference a past fragment to draw a " +
      "connection, but the question must still center on the target period/theme. Return " +
      "ONLY the question text, no preamble, no quotation marks.",
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
  skeleton: LifeSkeleton
): Promise<string> {
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
      "context if it helps sharpen the question. Nothing is taboo. Return ONLY the " +
      "question text, no preamble, no quotation marks.",
    messages: [
      {
        role: "user",
        content:
          `Life skeleton (standing context):\n${summarizeSkeleton(skeleton)}\n\n` +
          `What they just shared:\n${lastFragment.cleanedText}\n\n` +
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

/** Extracts life-skeleton facts from a single intake answer via tool use. */
export async function extractSkeletonFacts(cleanedText: string): Promise<SkeletonFacts> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    tools: [SKELETON_FACTS_TOOL],
    tool_choice: { type: "tool", name: "record_skeleton_facts" },
    system:
      "Extract rough life-skeleton facts from this intake answer: birth info, places lived " +
      "with rough date ranges, key relationships with rough eras, and major life transitions. " +
      "Only extract what's actually stated. Leave fields out entirely if not mentioned.",
    messages: [{ role: "user", content: cleanedText }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    return toolUse.input as SkeletonFacts;
  }
  return {};
}
