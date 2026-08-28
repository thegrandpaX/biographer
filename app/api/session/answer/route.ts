import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import {
  listFragments,
  readCoverageMap,
  readSavedQuestions,
  readSkeleton,
  saveFragment,
  writeCoverageMap,
  writeSavedQuestions,
  writeSkeleton,
} from "@/lib/drive";
import { assessTaper, cleanupTranscript, extractSkeletonFacts, inferTags } from "@/lib/claude";
import { markTaperedOff, recordFragment } from "@/lib/coverage";
import { mergeSkeletonFacts } from "@/lib/skeleton";
import { isGoogleAuthError } from "@/lib/authErrors";
import type { ThemeKey } from "@/lib/types";

interface AnswerBody {
  rawText: string;
  sourceQuestion?: string;
  targetPeriodId?: string;
  targetTheme?: ThemeKey;
  /** True when Scott started this on his own topic rather than answering the shown question. */
  selfDirected?: boolean;
  /** If this answers a previously-saved question, its id - cleared from the saved queue on success. */
  savedQuestionId?: string;
  /** Drive file IDs of photos already uploaded (via /api/photos) to attach to this fragment. */
  photoIds?: string[];
}

const RECENT_SAME_CELL_LIMIT = 3;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as AnswerBody;
  if (!body.rawText?.trim()) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  try {
    const [coverageMap, skeleton, fragments] = await Promise.all([
      readCoverageMap(session.accessToken),
      readSkeleton(session.accessToken),
      listFragments(session.accessToken),
    ]);

    const cleanedText = await cleanupTranscript(body.rawText);
    // A self-directed entry may arrive with no engine-picked target - fall
    // back to a neutral hint; inferTags tags from content either way.
    const hint = {
      periodId: body.targetPeriodId ?? coverageMap.periods[0]?.id ?? "unknown",
      theme: body.targetTheme ?? ("daily-life" as ThemeKey),
    };
    // Tagging and skeleton-fact extraction are independent of each other -
    // run them concurrently.
    const [tags, newFacts] = await Promise.all([
      inferTags(cleanedText, coverageMap.periods, hint, skeleton),
      extractSkeletonFacts(cleanedText),
    ]);

    // Promote any standing facts from this answer into the skeleton - not
    // just at intake - so it stays current instead of frozen at day one.
    const updatedSkeleton = mergeSkeletonFacts(skeleton, newFacts);
    await writeSkeleton(session.accessToken, updatedSkeleton);

    const fragment = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      periodId: tags.periodId,
      theme: tags.theme,
      sourceQuestion: body.sourceQuestion ?? "(Scott's own topic - no engine question)",
      rawText: body.rawText,
      cleanedText,
      chapterRefs: [] as string[],
      selfDirected: body.selfDirected ?? false,
      photoIds: body.photoIds ?? [],
      skeletonProcessed: true,
    };

    await saveFragment(session.accessToken, fragment);

    const sameCellFragments = fragments
      .filter((f) => f.periodId === tags.periodId && f.theme === tags.theme)
      .slice(0, RECENT_SAME_CELL_LIMIT);
    const tapered = await assessTaper(cleanedText, sameCellFragments);

    let updatedMap = recordFragment(coverageMap, tags.periodId, tags.theme);
    if (tapered) {
      updatedMap = markTaperedOff(updatedMap, tags.periodId, tags.theme);
    }
    await writeCoverageMap(session.accessToken, updatedMap);

    if (body.savedQuestionId) {
      const savedQuestions = await readSavedQuestions(session.accessToken);
      await writeSavedQuestions(
        session.accessToken,
        savedQuestions.filter((q) => q.id !== body.savedQuestionId)
      );
    }

    return NextResponse.json({ fragment });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
