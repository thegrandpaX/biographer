import Anthropic from "@anthropic-ai/sdk";
import { THEME_LABELS, type CoverageMap, type Fragment, type LifePeriod, type ThemeKey } from "./types";
import { pickNextTarget } from "./coverage";

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
  recentFragments: Fragment[]
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
      "If relevant, you may reference a past fragment to draw a connection, but the " +
      "question must still center on the target period/theme. Return ONLY the question " +
      "text, no preamble, no quotation marks.",
    messages: [
      {
        role: "user",
        content:
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
  hint: { periodId: string; theme: ThemeKey }
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
      "just the question that prompted it, since answers often wander to a different period.",
    messages: [
      {
        role: "user",
        content:
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
