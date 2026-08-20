import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { readCoverageMap, readSkeleton, saveFragment, writeCoverageMap } from "@/lib/drive";
import { cleanupTranscript, inferTags } from "@/lib/claude";
import { recordFragment } from "@/lib/coverage";
import { isGoogleAuthError } from "@/lib/authErrors";
import type { ThemeKey } from "@/lib/types";

interface AnswerBody {
  rawText: string;
  sourceQuestion: string;
  targetPeriodId: string;
  targetTheme: ThemeKey;
}

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
    const [coverageMap, skeleton] = await Promise.all([
      readCoverageMap(session.accessToken),
      readSkeleton(session.accessToken),
    ]);

    const cleanedText = await cleanupTranscript(body.rawText);
    const tags = await inferTags(
      cleanedText,
      coverageMap.periods,
      { periodId: body.targetPeriodId, theme: body.targetTheme },
      skeleton
    );

    const fragment = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      periodId: tags.periodId,
      theme: tags.theme,
      sourceQuestion: body.sourceQuestion,
      rawText: body.rawText,
      cleanedText,
      chapterRefs: [] as string[],
    };

    await saveFragment(session.accessToken, fragment);

    const updatedMap = recordFragment(coverageMap, tags.periodId, tags.theme);
    await writeCoverageMap(session.accessToken, updatedMap);

    return NextResponse.json({ fragment });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
