import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readSkeleton, writeSkeleton } from "@/lib/drive";
import { cleanupTranscript, extractSkeletonFacts } from "@/lib/claude";
import { mergeSkeletonFacts } from "@/lib/skeleton";

interface IntakeAnswerBody {
  rawText: string;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as IntakeAnswerBody;
  if (!body.rawText?.trim()) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  const [skeleton, cleanedText] = await Promise.all([
    readSkeleton(session.accessToken),
    cleanupTranscript(body.rawText),
  ]);

  const facts = await extractSkeletonFacts(cleanedText);
  const updatedSkeleton = mergeSkeletonFacts(skeleton, facts);
  await writeSkeleton(session.accessToken, updatedSkeleton);

  return NextResponse.json({ skeleton: updatedSkeleton });
}
